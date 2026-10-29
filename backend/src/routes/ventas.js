const express = require('express');
const router = express.Router();

const { conectarBD, sql } = require('../config/database');
const { verificarToken } = require('../middlewares/auth.middleware');

// POST /api/ventas
// Registra una venta y descuenta las unidades de lotes vigentes.
router.post('/', verificarToken, async (req, res) => {
  const { productos, MetodoPago, CanalVenta = 'Presencial' } = req.body;

  const metodosPermitidos = ['Efectivo', 'Tarjeta', 'Transferencia'];
  const canalesPermitidos = ['Presencial', 'Pedido'];

  if (
    !Array.isArray(productos) ||
    productos.length === 0 ||
    !metodosPermitidos.includes(MetodoPago) ||
    !canalesPermitidos.includes(CanalVenta)
  ) {
    return res.status(400).json({
      mensaje: 'Agrega productos y selecciona un método de pago y canal válidos.'
    });
  }

  const ids = new Set();

  for (const item of productos) {
    const id = Number(item.IdProducto);
    const cantidad = Number(item.Cantidad);

    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !Number.isInteger(cantidad) ||
      cantidad <= 0 ||
      ids.has(id)
    ) {
      return res.status(400).json({
        mensaje: 'Cada producto debe tener un identificador válido y una cantidad entera mayor que cero. No repitas productos.'
      });
    }

    ids.add(id);
  }

  const idUsuario = Number(req.usuario?.idUsuario);

  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    return res.status(401).json({
      mensaje: 'La sesión no contiene un usuario válido. Inicia sesión nuevamente.'
    });
  }

  let transaction;

  try {
    const pool = await conectarBD();
    transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    // Confirmar que el usuario siga activo.
    const usuario = await new sql.Request(transaction)
      .input('IdUsuario', sql.Int, idUsuario)
      .query(`
        SELECT IdUsuario
        FROM dbo.Usuarios WITH (UPDLOCK, HOLDLOCK)
        WHERE IdUsuario = @IdUsuario
          AND Estado = 1;
      `);

    if (usuario.recordset.length === 0) {
      throw new Error('El usuario no existe o está desactivado.');
    }

    // Crear la venta provisional dentro de la transacción.
    const venta = await new sql.Request(transaction)
      .input('IdUsuario', sql.Int, idUsuario)
      .input('MetodoPago', sql.VarChar(30), MetodoPago)
      .input('CanalVenta', sql.VarChar(30), CanalVenta)
      .query(`
        INSERT INTO dbo.Ventas (
          IdUsuario, MetodoPago, CanalVenta, Total, Estado
        )
        OUTPUT INSERTED.IdVenta
        VALUES (
          @IdUsuario, @MetodoPago, @CanalVenta, 0, 'Completada'
        );
      `);

    const idVenta = venta.recordset[0].IdVenta;
    let total = 0;

    for (const item of productos) {
      const idProducto = Number(item.IdProducto);
      const cantidadSolicitada = Number(item.Cantidad);

      // Bloquear el producto y su inventario mientras se procesa la venta.
      const producto = await new sql.Request(transaction)
        .input('IdProducto', sql.Int, idProducto)
        .query(`
          SELECT
            P.IdProducto,
            P.NombreProducto,
            P.Precio,
            I.Existencia
          FROM dbo.Productos AS P WITH (UPDLOCK, HOLDLOCK)
          INNER JOIN dbo.Inventario AS I WITH (UPDLOCK, HOLDLOCK)
            ON I.IdProducto = P.IdProducto
          WHERE P.IdProducto = @IdProducto
            AND P.Estado = 1;
        `);

      if (producto.recordset.length === 0) {
        throw new Error(
          `El producto ${idProducto} no existe, no tiene inventario o está desactivado.`
        );
      }

      const datosProducto = producto.recordset[0];
      const precio = Number(datosProducto.Precio);

      // Obtener los lotes vigentes con unidades disponibles, primero
      // los que vencen antes, para dar prioridad al vencimiento cercano.
      const lotes = await new sql.Request(transaction)
        .input('IdProducto', sql.Int, idProducto)
        .query(`
          SELECT
            IdLote,
            CantidadDisponible
          FROM dbo.LotesInventario WITH (UPDLOCK, HOLDLOCK)
          WHERE IdProducto = @IdProducto
            AND CantidadDisponible > 0
            AND FechaVencimiento >= CAST(GETDATE() AS DATE)
          ORDER BY FechaVencimiento ASC, FechaIngreso ASC, IdLote ASC;
        `);

      const unidadesDisponibles = lotes.recordset.reduce(
        (suma, lote) => suma + lote.CantidadDisponible,
        0
      );

      if (unidadesDisponibles < cantidadSolicitada) {
        throw new Error(
          `No hay suficientes unidades vigentes de ${datosProducto.NombreProducto}. Disponibles: ${unidadesDisponibles}. Solicitadas: ${cantidadSolicitada}.`
        );
      }

      if (datosProducto.Existencia < cantidadSolicitada) {
        throw new Error(
          `La existencia general de ${datosProducto.NombreProducto} es insuficiente.`
        );
      }

      // Descontar las unidades de uno o varios lotes.
      let pendientes = cantidadSolicitada;

      for (const lote of lotes.recordset) {
        if (pendientes === 0) break;

        const descontar = Math.min(
          pendientes,
          lote.CantidadDisponible
        );

        const actualizacion = await new sql.Request(transaction)
          .input('IdLote', sql.Int, lote.IdLote)
          .input('Cantidad', sql.Int, descontar)
          .query(`
            UPDATE dbo.LotesInventario
            SET CantidadDisponible = CantidadDisponible - @Cantidad
            WHERE IdLote = @IdLote
              AND CantidadDisponible >= @Cantidad;

            SELECT @@ROWCOUNT AS FilasActualizadas;
          `);

        if (actualizacion.recordset[0].FilasActualizadas !== 1) {
          throw new Error('No se pudo actualizar uno de los lotes.');
        }

        // Cada detalle indica el lote del que salieron las unidades.
        await new sql.Request(transaction)
          .input('IdVenta', sql.Int, idVenta)
          .input('IdProducto', sql.Int, idProducto)
          .input('IdLote', sql.Int, lote.IdLote)
          .input('Cantidad', sql.Int, descontar)
          .input('PrecioUnitario', sql.Decimal(10, 2), precio)
          .query(`
            INSERT INTO dbo.DetalleVenta (
              IdVenta, IdProducto, IdLote, Cantidad, PrecioUnitario
            )
            VALUES (
              @IdVenta, @IdProducto, @IdLote, @Cantidad, @PrecioUnitario
            );
          `);

        pendientes -= descontar;
      }

      // Actualizar el inventario general del producto.
      const inventario = await new sql.Request(transaction)
        .input('IdProducto', sql.Int, idProducto)
        .input('Cantidad', sql.Int, cantidadSolicitada)
        .query(`
          UPDATE dbo.Inventario
          SET Existencia = Existencia - @Cantidad,
              FechaActualizacion = SYSDATETIME()
          WHERE IdProducto = @IdProducto
            AND Existencia >= @Cantidad;

          SELECT @@ROWCOUNT AS FilasActualizadas;
        `);

      if (inventario.recordset[0].FilasActualizadas !== 1) {
        throw new Error(
          `No se pudo descontar el inventario de ${datosProducto.NombreProducto}.`
        );
      }

      total += precio * cantidadSolicitada;
    }

    // El total se calcula usando los precios guardados en la base de datos.
    total = Math.round((total + Number.EPSILON) * 100) / 100;

    await new sql.Request(transaction)
      .input('IdVenta', sql.Int, idVenta)
      .input('Total', sql.Decimal(12, 2), total)
      .query(`
        UPDATE dbo.Ventas
        SET Total = @Total
        WHERE IdVenta = @IdVenta;
      `);

    await transaction.commit();
    transaction = null;

    return res.status(201).json({
      mensaje: 'Venta registrada correctamente.',
      IdVenta: idVenta,
      Total: total
    });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (errorRollback) {
        console.error('Error al revertir la venta:', errorRollback.message);
      }
    }

    console.error('Error al registrar venta:', error.message);

    return res.status(400).json({
      mensaje: error.message || 'No se pudo registrar la venta.'
    });
  }
});

module.exports = router;


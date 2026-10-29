
const express = require('express')
const router = express.Router()
const { conectarBD, sql } = require('../config/database')

// =============================================
// CONSULTAR PRODUCTOS ACTIVOS
// Incluye las fechas del lote más reciente.
// =============================================
router.get('/', async (req, res) => {
  try {
    const pool = await conectarBD()

    const resultado = await pool.request().query(`
      SELECT
        P.IdProducto,
        P.NombreProducto,
        P.Descripcion,
        P.Precio,
        I.Existencia,
        I.StockMinimo,
        L.IdLote,
        L.CantidadDisponible AS CantidadLote,
        CONVERT(VARCHAR(10), L.FechaIngreso, 23) AS FechaIngreso,
        CONVERT(VARCHAR(10), L.FechaVencimiento, 23) AS FechaVencimiento
      FROM dbo.Productos AS P
      LEFT JOIN dbo.Inventario AS I
        ON P.IdProducto = I.IdProducto
      OUTER APPLY (
        SELECT TOP 1
          LI.IdLote,
          LI.CantidadDisponible,
          LI.FechaIngreso,
          LI.FechaVencimiento
        FROM dbo.LotesInventario AS LI
        WHERE LI.IdProducto = P.IdProducto
        ORDER BY LI.IdLote DESC
      ) AS L
      WHERE P.Estado = 1
      ORDER BY P.NombreProducto;
    `)

    res.json(resultado.recordset)
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al consultar los productos',
      error: error.message
    })
  }
})

// =============================================
// CONSULTAR TODOS LOS LOTES PARA INVENTARIO
// Incluye un estado calculado según vencimiento.
// =============================================
router.get('/lotes', async (req, res) => {
  try {
    const pool = await conectarBD()

    const resultado = await pool.request().query(`
      SELECT
        L.IdLote,
        P.IdProducto,
        P.NombreProducto,
        P.Precio,
        L.CantidadInicial,
        L.CantidadDisponible,
        I.Existencia,
        I.StockMinimo,
        CONVERT(VARCHAR(10), L.FechaIngreso, 23) AS FechaIngreso,
        CONVERT(VARCHAR(10), L.FechaVencimiento, 23) AS FechaVencimiento,
        CASE
          WHEN L.CantidadDisponible = 0 THEN 'Agotado'
          WHEN L.FechaVencimiento < CAST(GETDATE() AS DATE)
            THEN 'Vencido'
          WHEN L.FechaVencimiento <= DATEADD(
            DAY, 3, CAST(GETDATE() AS DATE)
          )
            THEN 'Proximo a vencer'
          ELSE 'Vigente'
        END AS EstadoVencimiento
      FROM dbo.LotesInventario AS L
      INNER JOIN dbo.Productos AS P
        ON L.IdProducto = P.IdProducto
      LEFT JOIN dbo.Inventario AS I
        ON I.IdProducto = P.IdProducto
      ORDER BY L.FechaVencimiento, P.NombreProducto;
    `)

    res.json(resultado.recordset)
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al consultar los lotes del inventario',
      error: error.message
    })
  }
})

// =============================================
// REGISTRAR UN PRODUCTO Y SU PRIMER LOTE
// =============================================
router.post('/', async (req, res) => {
  const {
    NombreProducto,
    Descripcion,
    Precio,
    Existencia,
    StockMinimo,
    FechaIngreso,
    FechaVencimiento
  } = req.body

  const precio = Number(Precio)
  const existencia = Number(Existencia)
  const stockMinimo = Number(StockMinimo)

  const fechaValida = (fecha) => {
    if (
      typeof fecha !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
      return false
    }

    const fechaDate = new Date(`${fecha}T00:00:00Z`)

    return (
      !Number.isNaN(fechaDate.getTime()) &&
      fechaDate.toISOString().slice(0, 10) === fecha
    )
  }

  if (
    typeof NombreProducto !== 'string' ||
    !NombreProducto.trim() ||
    NombreProducto.trim().length > 100 ||
    (Descripcion != null &&
      (typeof Descripcion !== 'string' || Descripcion.length > 200)) ||
    Precio === '' ||
    Precio == null ||
    !Number.isFinite(precio) ||
    !Number.isInteger(Math.round(precio * 100)) ||
    Math.round(precio * 100) !== precio * 100 ||
    precio < 0 ||
    Existencia === '' ||
    Existencia == null ||
    !Number.isInteger(existencia) ||
    existencia <= 0 ||
    StockMinimo === '' ||
    StockMinimo == null ||
    !Number.isInteger(stockMinimo) ||
    stockMinimo < 0 ||
    !fechaValida(FechaIngreso) ||
    !fechaValida(FechaVencimiento) ||
    FechaVencimiento < FechaIngreso
  ) {
    return res.status(400).json({
      mensaje:
        'Revisa los datos. El nombre, precio, existencia inicial mayor que cero, stock mínimo y fechas válidas son obligatorios. El vencimiento no puede ser anterior al ingreso.'
    })
  }

  let transaction

  try {
    const pool = await conectarBD()
    transaction = new sql.Transaction(pool)
    await transaction.begin()

    // 1. Crear el producto
    const resultado = await new sql.Request(transaction)
      .input('NombreProducto', sql.VarChar(100), NombreProducto.trim())
      .input(
        'Descripcion',
        sql.VarChar(200),
        Descripcion?.trim() || null
      )
      .input('Precio', sql.Decimal(10, 2), precio)
      .query(`
        INSERT INTO dbo.Productos (
          NombreProducto,
          Descripcion,
          Precio
        )
        OUTPUT INSERTED.IdProducto
        VALUES (
          @NombreProducto,
          @Descripcion,
          @Precio
        );
      `)

    const idProducto = resultado.recordset[0].IdProducto

    // 2. Crear el inventario general
    await new sql.Request(transaction)
      .input('IdProducto', sql.Int, idProducto)
      .input('Existencia', sql.Int, existencia)
      .input('StockMinimo', sql.Int, stockMinimo)
      .query(`
        INSERT INTO dbo.Inventario (
          IdProducto,
          Existencia,
          StockMinimo
        )
        VALUES (
          @IdProducto,
          @Existencia,
          @StockMinimo
        );
      `)

    // 3. Crear el primer lote con ambas fechas
    await new sql.Request(transaction)
      .input('IdProducto', sql.Int, idProducto)
      .input('CantidadInicial', sql.Int, existencia)
      .input('CantidadDisponible', sql.Int, existencia)
      .input('FechaIngreso', sql.Date, FechaIngreso)
      .input('FechaVencimiento', sql.Date, FechaVencimiento)
      .query(`
        INSERT INTO dbo.LotesInventario (
          IdProducto,
          CantidadInicial,
          CantidadDisponible,
          FechaIngreso,
          FechaVencimiento
        )
        VALUES (
          @IdProducto,
          @CantidadInicial,
          @CantidadDisponible,
          @FechaIngreso,
          @FechaVencimiento
        );
      `)

    await transaction.commit()

    res.status(201).json({
      mensaje: 'Producto, inventario y lote registrados correctamente',
      IdProducto: idProducto
    })
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback()
      } catch {}
    }

    res.status(500).json({
      mensaje: 'Error al registrar el producto y su lote',
      error: error.message
    })
  }
})

// =============================================
// EDITAR UN PRODUCTO
// =============================================
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { NombreProducto, Descripcion, Precio } = req.body
  const precio = Number(Precio)

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof NombreProducto !== 'string' ||
    !NombreProducto.trim() ||
    NombreProducto.trim().length > 100 ||
    (Descripcion != null &&
      (typeof Descripcion !== 'string' || Descripcion.length > 200)) ||
    Precio === '' ||
    Precio == null ||
    !Number.isFinite(precio) ||
    precio < 0 ||
    Math.round(precio * 100) !== precio * 100
  ) {
    return res.status(400).json({
      mensaje: 'Los datos del producto no son válidos.'
    })
  }

  try {
    const pool = await conectarBD()

    const resultado = await pool.request()
      .input('IdProducto', sql.Int, id)
      .input('NombreProducto', sql.VarChar(100), NombreProducto.trim())
      .input(
        'Descripcion',
        sql.VarChar(200),
        Descripcion?.trim() || null
      )
      .input('Precio', sql.Decimal(10, 2), precio)
      .query(`
        UPDATE dbo.Productos
        SET NombreProducto = @NombreProducto,
            Descripcion = @Descripcion,
            Precio = @Precio
        WHERE IdProducto = @IdProducto
          AND Estado = 1;

        SELECT @@ROWCOUNT AS FilasActualizadas;
      `)

    if (resultado.recordset[0].FilasActualizadas === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró el producto activo.'
      })
    }

    res.json({
      mensaje: 'Producto actualizado correctamente'
    })
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al actualizar el producto',
      error: error.message
    })
  }
})

// =============================================
// DESACTIVAR UN PRODUCTO SIN ELIMINARLO
// =============================================
router.patch('/:id/desactivar', async (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      mensaje: 'El identificador del producto no es válido.'
    })
  }

  try {
    const pool = await conectarBD()

    const resultado = await pool.request()
      .input('IdProducto', sql.Int, id)
      .query(`
        UPDATE dbo.Productos
        SET Estado = 0
        WHERE IdProducto = @IdProducto
          AND Estado = 1;

        SELECT @@ROWCOUNT AS FilasActualizadas;
      `)

    if (resultado.recordset[0].FilasActualizadas === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró el producto activo.'
      })
    }

    res.json({
      mensaje: 'Producto desactivado correctamente'
    })
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al desactivar el producto',
      error: error.message
    })
  }
})


/* =============================================
   REGISTRAR UNA NUEVA ENTRADA DE INVENTARIO
   Para un producto que ya existe.
============================================= */
router.post('/lotes', async (req, res) => {
  const {
    IdProducto,
    Cantidad,
    FechaIngreso,
    FechaVencimiento
  } = req.body

  const idProducto = Number(IdProducto)
  const cantidad = Number(Cantidad)

  function fechaValida(fecha) {
    if (
      typeof fecha !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
      return false
    }

    const fechaDate = new Date(`${fecha}T00:00:00Z`)

    return (
      !Number.isNaN(fechaDate.getTime()) &&
      fechaDate.toISOString().slice(0, 10) === fecha
    )
  }

  if (
    !Number.isInteger(idProducto) ||
    idProducto <= 0 ||
    Cantidad === '' ||
    Cantidad == null ||
    !Number.isInteger(cantidad) ||
    cantidad <= 0 ||
    !fechaValida(FechaIngreso) ||
    !fechaValida(FechaVencimiento) ||
    FechaVencimiento < FechaIngreso
  ) {
    return res.status(400).json({
      mensaje:
        'Verifica el producto, la cantidad y las fechas. La cantidad debe ser mayor que cero y el vencimiento no puede ser anterior al ingreso.'
    })
  }

  let transaction

  try {
    const pool = await conectarBD()

    transaction = new sql.Transaction(pool)
    await transaction.begin()

    // 1. Verificar que el producto exista y esté activo.
    const producto = await new sql.Request(transaction)
      .input('IdProducto', sql.Int, idProducto)
      .query(`
        SELECT IdProducto
        FROM dbo.Productos
        WHERE IdProducto = @IdProducto
          AND Estado = 1;
      `)

    if (producto.recordset.length === 0) {
      await transaction.rollback()
      transaction = null

      return res.status(404).json({
        mensaje: 'El producto no existe o está desactivado.'
      })
    }

    // 2. Crear el nuevo lote.
    await new sql.Request(transaction)
      .input('IdProducto', sql.Int, idProducto)
      .input('CantidadInicial', sql.Int, cantidad)
      .input('CantidadDisponible', sql.Int, cantidad)
      .input('FechaIngreso', sql.Date, FechaIngreso)
      .input('FechaVencimiento', sql.Date, FechaVencimiento)
      .query(`
        INSERT INTO dbo.LotesInventario (
          IdProducto,
          CantidadInicial,
          CantidadDisponible,
          FechaIngreso,
          FechaVencimiento
        )
        VALUES (
          @IdProducto,
          @CantidadInicial,
          @CantidadDisponible,
          @FechaIngreso,
          @FechaVencimiento
        );
      `)

    // 3. Actualizar el inventario general.
    const inventario = await new sql.Request(transaction)
      .input('IdProducto', sql.Int, idProducto)
      .input('Cantidad', sql.Int, cantidad)
      .query(`
        UPDATE dbo.Inventario
        SET Existencia = Existencia + @Cantidad,
            FechaActualizacion = SYSDATETIME()
        WHERE IdProducto = @IdProducto;

        SELECT @@ROWCOUNT AS FilasActualizadas;
      `)

    if (inventario.recordset[0].FilasActualizadas === 0) {
      throw new Error(
        'No existe un registro de inventario para este producto.'
      )
    }

    await transaction.commit()
    transaction = null

    return res.status(201).json({
      mensaje: 'Nueva entrada de inventario registrada correctamente.'
    })
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback()
      } catch {}
    }

    return res.status(500).json({
      mensaje: 'Error al registrar la entrada de inventario.',
      error: error.message
    })
  }
})


module.exports = router

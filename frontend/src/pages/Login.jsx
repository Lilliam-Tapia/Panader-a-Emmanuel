
import { useState } from 'react'
import '../style/Login.css'

const API_URL = '/api/auth/login'

export default function Login({ onLogin }) {
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [mostrarContrasena, setMostrarContrasena] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function manejarLogin(e) {
    e.preventDefault()
    setError('')

    if (!nombreUsuario.trim() || !contrasena) {
      setError('Ingresa tu usuario y contraseña.')
      return
    }

    try {
      setCargando(true)

      const respuesta = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nombreUsuario: nombreUsuario.trim(),
          contrasena
        })
      })

      const datos = await respuesta.json()

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No se pudo iniciar sesión.')
      }
     console.log('Datos del usuario:', datos.usuario);
      onLogin(datos)
    } catch (err) {
      setError(
        err.message === 'Failed to fetch'
          ? 'No se pudo conectar con el servidor. Comprueba que el backend esté encendido.'
          : err.message || 'Ocurrió un error al iniciar sesión.'
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-logo">E</div>
          <p className="login-eyebrow">PANADERIA</p>
          <h1>EMMANUEL</h1>
          <p className="login-subtitle">Sistema de ventas y facturación</p>
        </div>

        <div className="login-heading">
          <h2>Bienvenido</h2>
          <p>Ingresa tus datos para continuar.</p>
        </div>

        <form onSubmit={manejarLogin}>
          <label htmlFor="nombreUsuario">Usuario</label>
          <input
            id="nombreUsuario"
            type="text"
            placeholder="Ingresa tu usuario"
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
            autoComplete="username"
            maxLength={50}
            disabled={cargando}
          />

          <label htmlFor="contrasena">Contraseña</label>
          <div className="login-password">
            <input
              id="contrasena"
              type={mostrarContrasena ? 'text' : 'password'}
              placeholder="Ingresa tu contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              autoComplete="current-password"
              disabled={cargando}
            />
            <button
              className="login-show-password"
              type="button"
              onClick={() => setMostrarContrasena(!mostrarContrasena)}
              aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {mostrarContrasena ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={cargando}
          >
            {cargando ? 'Verificando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="login-footer">
          Acceso exclusivo para personal autorizado
        </p>
      </section>
    </main>
  )
}


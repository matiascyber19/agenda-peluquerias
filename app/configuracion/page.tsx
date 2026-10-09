import Navbar from '../components/Navbar'
import SeccionContacto from './SeccionContacto'
import SeccionReglas from './SeccionReglas'
import SeccionHorarios from './SeccionHorarios'
import SeccionCierres from './SeccionCierres'

export default function ConfiguracionPage() {
  return (
    <div className="min-h-screen fondo-panel">
      <Navbar />

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="mt-1 text-sm text-gray-500">Contacto, reglas de reserva, horarios y días cerrados de tu peluquería</p>
        </div>

        <SeccionContacto />
        <SeccionReglas />
        <SeccionHorarios />
        <SeccionCierres />
      </div>
    </div>
  )
}

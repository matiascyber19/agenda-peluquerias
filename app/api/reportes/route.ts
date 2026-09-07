import { createClient } from "@/app/lib/supabase/server";
import { NextResponse } from "next/server";

//obtener datos para los reportes
export async function GET(request: Request){
    try{
        const supabase = await createClient() //conectar usando sesion actual

        //verificar usuario antes de permitir consultar reportes
        const{
            data: {user},
            error: authError,
        } = await supabase.auth.getUser()
        if(authError || !user){
            return NextResponse.json(
                {error: 'Usuario no autenticado'},
                {status: 401}
            )
        }

        //leer rango de fechas enviado en la URL
        const {searchParams} = new URL(request.url)
        const desde = searchParams.get('desde')
        const hasta = searchParams.get('hasta')

        //exigir fecha inicial y final para generar reporte
        if(!desde || !hasta){
            return NextResponse.json(
                {error: 'Ingrese las fechas desde y hasta'},
                {status: 400}
            )
        }
        //validamos el formato de fecha YYYY-MM-DD
        const formatoFecha = /^\d{4}-\d{2}-\d{2}$/
        if(!formatoFecha.test(desde) || !formatoFecha.test(hasta)){
            return NextResponse.json(
                {error:'Las fechas deben usar el formato AÑO-MES-DIA (ej: 2026-06-16)'}, 
                {status:400}
            )
        }
        //convertir fechas para comprobar existencia
        const fechaDesde = new Date(`${desde}T00:00:00`)
        const fechaHasta = new Date(`${hasta}T23:59:59.999`)
        if(Number.isNaN(fechaDesde.getTime()) || Number.isNaN(fechaHasta.getTime())){
            return NextResponse.json(
                {error:'Una de las fechas ingresadas no es válida'},
                {status:400}
            )
        }
        //evitar rango donde fecha inicial sea posterior a fecha final
        if(fechaDesde>fechaHasta){
            return NextResponse.json(
                {error:'La fecha desde no puede ser posterior a la fecha hasta'},
                {status:400}
            )
        }

        //consultar ventas realizadas dentro del rango de fechas
        const {data: ventas, error: ventasError} = await supabase
            .from('ventas') //desde tabla ventas
            .select('id,total_clp,medio_pago,fecha') //seleccionamos los datos necesarios pal reporte
            .gte('fecha', fechaDesde.toISOString()) //de fecha mayor o igual al inicio del periodo
            .lte('fecha', fechaHasta.toISOString()) //y de fecha menor o igual al final del periodo
        //detener reporte si falla consulta a ventas
        if(ventasError){
            return NextResponse.json(
                {error: `Error al consultar ventas: ${ventasError.message}`},
                {status: 500}
            )
        }

        //sumar total de todas las ventas encontradas
        const ingresosTotales = (ventas || []).reduce((total,venta) => total + (venta.total_clp || 0), 0)

        //guardar ingresos separados segun medio de pago
        const ingresosPorMedioPago = {
            efectivo: 0,
            transferencia: 0,
            debito: 0,
            credito: 0,
        }

        //sumar cada venta en su medio de pago correspondiente
        for(const venta of ventas || []){
            const medio = venta.medio_pago as keyof typeof ingresosPorMedioPago
            if(medio in ingresosPorMedioPago){
                ingresosPorMedioPago[medio] += venta.total_clp || 0
            }
        }

        //consultar gastos registrados dentro del rango de fechas
        const{data:gastos, error:gastosError} = await supabase
            .from('gastos')
            .select('id,descripcion,categoria,monto_clp,fecha')
            .gte('fecha', desde)
            .lte('fecha', hasta)
        //detener reporte si falla consulta de gastos
        if(gastosError){
            return NextResponse.json(
                {error: `Error al consultar gastos: ${gastosError.message}`},
                {status: 500}
            )
        }

        //sumar monto de todos los gastos encontrados
        const gastosTotales = (gastos || []).reduce((total,gasto) => total + (gasto.monto_clp || 0),0)

        //guardar total gastado en cada categoria encontrada
        const gastosPorCategoria: Record<string,number> = {}

        //sumar cada gasto en su categoria correspondiente
        for(const gasto of gastos || []){
            const categoria = gasto.categoria || 'sin_categoria'
            if(!gastosPorCategoria[categoria]){
                gastosPorCategoria[categoria] = 0
            }
            gastosPorCategoria[categoria] += gasto.monto_clp || 0
        }

        //calcular diferencia entre ingresos y gastos
        const balance = ingresosTotales - gastosTotales
        //consultar citas dentro del rango de fechas
        const {data:citas, error:citasError} = await supabase
            .from('citas')
            .select('id,estado,inicio,cita_servicios(servicio_id,servicios(id,nombre))')
            .gte('inicio',fechaDesde.toISOString())
            .lte('inicio',fechaHasta.toISOString())
        //detener reporte si falla consulta de citas
        if(citasError){
            return NextResponse.json(
                {error: `Error al consultar citas: ${citasError.message}`},
                {status:500}
            )
        }

        //contar cantidad total de citas encontradas
        const totalCitas = citas?.length || 0
        //contar citas según su estado
        const citasPorEstado = {
            pendiente: 0,
            confirmada: 0,
            completada: 0,
            cancelada: 0,
            no_show: 0,
        }
        for(const cita of citas || []){
            const estado = cita.estado as keyof typeof citasPorEstado
            if(estado in citasPorEstado){
                citasPorEstado[estado] ++
            }
        }

        //calcular % de clientes que no llegan a sus citas
        const porcentajeNoShow = totalCitas > 0
            ? Number(
                ((citasPorEstado.no_show / totalCitas)*100).toFixed(2)
            ) : 0

        //guardar cantidad de veces que aparece cada servicio
        const contadorServicios: Record<string,{
            id: string
            nombre: string
            cantidad: number
        }> = {}

        //contar servicios asociados a las citas encontradas
        for(const cita of citas || []){
            for(const detalle of cita.cita_servicios || []){
                const servicioRelacionado = detalle.servicios as any
                if(!servicioRelacionado){
                    continue
                }
                const servicio = Array.isArray(servicioRelacionado)
                ? servicioRelacionado[0]
                : servicioRelacionado
                if(!servicio?.id){
                    continue
                }
                if(!contadorServicios[servicio.id]){
                    contadorServicios[servicio.id] = {
                        id:servicio.id,
                        nombre:servicio.nombre,
                        cantidad:0
                    }
                }
                contadorServicios[servicio.id].cantidad++
            }
        }

        //ordenar servicios desde el mas realizado al menos
        const serviciosMasRealizados = Object
            .values(contadorServicios)
            .sort((a,b) => b.cantidad - a.cantidad)
            .slice(0,5)

        //devolver la informacion (ctmre porfin) completa para el fRonEN de reportes hecho por mattisito ÑAM ÑAM
        return NextResponse.json({
            periodo:{
                desde,
                hasta,
            },
            resumen:{
                ingresosTotales,
                gastosTotales,
                balance,
                totalVentas: ventas?.length || 0,
                totalGastos: gastos?.length || 0,
                totalCitas,
                porcentajeNoShow
            },
            ventas:{
                ingresosPorMedioPago,
            },
            gastos:{
                gastosPorCategoria,
            },
            citas:{
                porEstado: citasPorEstado,
            },
            servicios:{
                masRealizados: serviciosMasRealizados,
            },
        })

    } catch(error) {
        console.error('Error en GET /api/reportes: ', error)
        return NextResponse.json(
            {error: 'Error interno del servidor'},
            {status: 500}
        )
    }
}
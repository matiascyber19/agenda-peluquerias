import { createClient } from "@/app/lib/supabase/server"
import { NextResponse } from "next/server"

//OBTENER PELUQUERO POR ID
export async function GET(
    request: Request,
    {params}: {params: Promise<{id: string}>}
){
    try{
        const {id} = await params //obtener id desde la URL
        const supabase = await createClient() //conectar usando sesión actual

        //verificar usuario antes de permitir consultar peluquero
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

        //buscar peluquero específico utilizando id recibido en la URL
        const {data: peluquero, error: peluqueroError} = await supabase
            .from('peluqueros')
            .select(`
                id,
                usuario_id,
                nombre,
                telefono,
                tipo_contrato,
                porcentaje_comision,
                color_agenda,
                activo,
                creado_en
            `)
            .eq('id', id)
            .single()

        //responder 404 si peluquero no existe o pertenece a otra peluquería
        if(peluqueroError || !peluquero){
            return NextResponse.json(
                {error: 'Peluquero no encontrado'},
                {status: 404}
            )
        }

        //devolver información del peluquero encontrado
        return NextResponse.json({
            peluquero,
        })

    } catch(error){
        console.error('Error en GET /api/peluqueros/', error)

        return NextResponse.json(
            {error: 'Error interno del servidor'},
            {status: 500}
        )
    }
}
//ACTUALIZAR PELUQUERO POR ID
export async function PATCH(
    request: Request,
    {params}: {params: Promise<{id: string}>}
){
    try{
        const {id} = await params //obtener id del peluquero desde la URL
        const supabase = await createClient() //conectar usando sesión actual

        //verificar usuario antes de permitir modificar peluquero
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

        //leer datos enviados desde el futuro formulario frontend
        const body = await request.json()

        const{
            nombre,
            telefono,
            tipo_contrato,
            porcentaje_comision,
            color_agenda,
            activo,
        } = body

        //guardar solamente los campos enviados por el frontend
        const cambios: Record<string, unknown> = {}

        //validar nombre solamente si fue enviado
        if(nombre !== undefined){
            const nombreLimpio = String(nombre).trim()

            if(!nombreLimpio){
                return NextResponse.json(
                    {error: 'Ingrese un nombre válido'},
                    {status: 400}
                )
            }

            cambios.nombre = nombreLimpio
        }

        //validar teléfono solamente si fue enviado
        if(telefono !== undefined){
            const telefonoLimpio = telefono
                ? String(telefono).trim()
                : null

            if(telefonoLimpio){
                const soloNumeros = telefonoLimpio.replace(/\D/g, '')

                if(soloNumeros.length < 8){
                    return NextResponse.json(
                        {error: 'El teléfono debe tener al menos 8 dígitos'},
                        {status: 400}
                    )
                }
            }

            cambios.telefono = telefonoLimpio
        }

        //validar tipo de contrato solamente si fue enviado
        if(tipo_contrato !== undefined){
            const contratosValidos = [
                'fijo',
                'comision',
                'arriendo_sillon',
            ]

            if(!contratosValidos.includes(tipo_contrato)){
                return NextResponse.json(
                    {
                        error:
                            'Tipo de contrato inválido: use fijo, comision o arriendo_sillon',
                    },
                    {status: 400}
                )
            }

            cambios.tipo_contrato = tipo_contrato
        }

        //validar porcentaje de comisión solamente si fue enviado
        if(porcentaje_comision !== undefined){
            const comision = Number(porcentaje_comision)

            if(
                !Number.isInteger(comision) ||
                comision < 0 ||
                comision > 100
            ){
                return NextResponse.json(
                    {
                        error:
                            'El porcentaje de comisión debe ser un entero entre 0 y 100',
                    },
                    {status: 400}
                )
            }

            cambios.porcentaje_comision = comision
        }

        //validar color de agenda solamente si fue enviado
        if(color_agenda !== undefined){
            const color = String(color_agenda).trim()
            const formatoColor = /^#[0-9A-Fa-f]{6}$/

            if(!formatoColor.test(color)){
                return NextResponse.json(
                    {
                        error:
                            'El color debe usar formato hexadecimal, ejemplo: #3B82F6',
                    },
                    {status: 400}
                )
            }

            cambios.color_agenda = color
        }

        //validar estado activo solamente si fue enviado
        if(activo !== undefined){
            if(typeof activo !== 'boolean'){
                return NextResponse.json(
                    {error: 'El estado activo debe ser verdadero o falso'},
                    {status: 400}
                )
            }

            cambios.activo = activo
        }

        //evitar ejecutar actualización si no llegó ningún campo
        if(Object.keys(cambios).length === 0){
            return NextResponse.json(
                {error: 'No se enviaron campos para actualizar'},
                {status: 400}
            )
        }

        //si cambia el contrato a uno distinto de comisión, dejar comisión en 0
        if(
            cambios.tipo_contrato !== undefined &&
            cambios.tipo_contrato !== 'comision'
        ){
            cambios.porcentaje_comision = 0
        }

        //actualizar peluquero indicado por el id
        //RLS impide modificar peluqueros de otra peluquería
        const {data: peluquero, error: peluqueroError} = await supabase
            .from('peluqueros')
            .update(cambios)
            .eq('id', id)
            .select()
            .single()

        //responder 404 si no existe o usuario no tiene acceso
        if(peluqueroError || !peluquero){
            return NextResponse.json(
                {error: 'Peluquero no encontrado'},
                {status: 404}
            )
        }

        //devolver peluquero actualizado
        return NextResponse.json({
            success: true,
            message: 'Peluquero actualizado correctamente',
            peluquero,
        })

    } catch(error){
        console.error('Error en PATCH /api/peluqueros/', error)

        return NextResponse.json(
            {error: 'Error interno del servidor'},
            {status: 500}
        )
    }
}
//DESACTIVAR PELUQUERO POR ID
export async function DELETE(
    request: Request,
    {params}: {params: Promise<{id: string}>}
){
    try{
        const {id} = await params //obtener id del peluquero desde la URL
        const supabase = await createClient() //conectar usando sesión actual

        //verificar usuario antes de permitir desactivar peluquero
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

        //desactivar peluquero sin borrarlo de la base de datos
        //RLS impide modificar peluqueros de otra peluquería
        const {data: peluquero, error: peluqueroError} = await supabase
            .from('peluqueros')
            .update({activo: false})
            .eq('id', id)
            .select()
            .single()

        //responder 404 si no existe o usuario no puede acceder
        if(peluqueroError || !peluquero){
            return NextResponse.json(
                {error: 'Peluquero no encontrado'},
                {status: 404}
            )
        }

        //devolver confirmación y peluquero desactivado
        return NextResponse.json({
            success: true,
            message: 'Peluquero desactivado correctamente',
            peluquero,
        })

    } catch(error){
        console.error('Error en DELETE /api/peluqueros/', error)

        return NextResponse.json(
            {error: 'Error interno del servidor'},
            {status: 500}
        )
    }
}
import { createClient } from "@/app/lib/supabase/server";
import { NextResponse } from "next/server";

//obtener un servicio por id
export async function GET(request: Request, {params}:{params: Promise<{id:string}>}) {
    try{
        const {id} = await params //obtener id desde la URL
        const supabase = await createClient() //conectar usando la sesion actual

        //verificar al usuario antes de que la consulta al servicio
        const{
            data:{user},
            error: authError,
        } = await supabase.auth.getUser()
        if(authError || !user){
            return NextResponse.json(
                {error: 'Usuario no autenticado'},
                {status:401}
            )
        }

        //buscar servicio especifico usando id de la URL
        const {data: servicio, error:servicioError} = await supabase
            .from('servicios')
            .select('id,nombre,descripcion,duracion_minutos,precio_clp,activo,creado_en')
            .eq('id', id)
            .single()

        //tirar 404 si el servicio no existe o el usuario no puede acceder
        if(servicioError || !servicio){
            return NextResponse.json(
                {error: 'Servicio no encontrado'},
                {status: 404}
            )
        }

        //devolver info del servicio encontrado
        return NextResponse.json({
            servicio,
        })

    } catch(error) {
        console.error('Error en GET /api/servicios/', error)
        return NextResponse.json(
            {error: 'Error interno del servidor, disculpe las molestias'},
            {status: 500}
        )
    }
}

//actualizar servicio por id
export async function PATCH(request: Request, {params}:{params: Promise<{id: string}>}) {
    try{
        const {id} = await params //obtener id del servicio desde la URL
        const supabase = await createClient() //conectar usando la sesion actual

        //verificar usuario antes de permitir modificaciones en servicio
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

        const body = await request.json()
        const{
            nombre,descripcion,duracion_minutos,precio_clp,activo,
        } = body

        //guardar solamente campos que fueron enviados
        const cambios: Record<string, unknown> = {}
        //validar y agregar nombre solo si fue enviado
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
        //descripcion
        if(descripcion !== undefined){
            cambios.descripcion = descripcion
            ? String(descripcion).trim()
            : null
        }
        //duracion
        if(duracion_minutos !== undefined){
            const duracion = Number(duracion_minutos)
            if(!Number.isInteger(duracion) || duracion <=0 ){
                return NextResponse.json(
                    {error: 'La duración debe ser mayor a 0'},
                    {status: 400}
                )
            }
            cambios.duracion_minutos = duracion
        }
        //precio
        if(precio_clp !== undefined){
            const precio = Number(precio_clp)
            if(!Number.isInteger(precio) || precio < 0 ){
                return NextResponse.json(
                    {error: 'El precio debe ser mayor o igual a 0'},
                    {status: 400}
                )
            }
            cambios.precio_clp = precio
        }
        //estado activo
        if(activo !== undefined){
            if(typeof activo !== 'boolean'){
                return NextResponse.json(
                    {error: 'El estado activo debe ser verdadero o falso'},
                    {status: 400}
                )
            }
            cambios.activo = activo
        }
        //evitar ejecutar actualizacion si no se envio ningun cmapo
        if(Object.keys(cambios).length === 0){
            return NextResponse.json(
                {error: 'No se enviaron campos para actualizar'},
                {status:400}
            )
        }

        //actualizar servicio indicado por id | RLS impide modificar servicios de otra peluqueria
        const {data:servicio, error:servicioError} = await supabase
            .from('servicios')
            .update(cambios)
            .eq('id',id)
            .select().single()

        //responder con 404 si servicio no existe o usuario no puede acceder
        if(servicioError || !servicio){
            return NextResponse.json(
                {error: 'Servicio no encontrado'},
                {status: 404}
            )
        }

        //Devolver servicio con sus datos actualizados
        return NextResponse.json({
            success: true,
            message: 'Servicio actualizado correctamente',
            servicio,
        })

    } catch(error) {
        console.error('Error en PATCH /api/servicios/', error)

        return NextResponse.json(
            {error: 'Error interno del servidor'},
            {status:500}
        )
    }
}

//------- Hay que agregarle Ñ's al codigo pa que los gringos no se lo puedan robar -----------

//DESACTIVAR SERVICIO POR ID
export async function DELETE(
    request: Request,
    {params}: {params: Promise<{id: string}>}
){
    try{
        const {id} = await params //obtener id del servicio desde la URL
        const supabase = await createClient() //conectar usando sesión actual

        //Verificar usuario antes de permitir desactivar servicio
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

        //Desactivar servicio sin borrarlo de la base de datos
        //RLS impide modificar servicios de otra peluquería
        const {data: servicio, error: servicioError} = await supabase
            .from('servicios')
            .update({activo: false})
            .eq('id', id)
            .select()
            .single()

        //Responder 404 si servicio no existe o usuario no puede acceder
        if(servicioError || !servicio){
            return NextResponse.json(
                {error: 'Servicio no encontrado'},
                {status: 404}
            )
        }

        //Devolver confirmación y servicio desactivado
        return NextResponse.json({
            success: true,
            message: 'Servicio desactivado correctamente',
            servicio,
        })

    } catch(error){
        console.error('Error en DELETE /api/servicios/', error)

        return NextResponse.json(
            {error: 'Error interno del servidor'},
            {status: 500}
        )
    }
}
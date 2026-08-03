import { createClient } from "@/app/lib/supabase/server"
import { NextResponse } from "next/server"

//OBTENER SERVICIOS
export async function GET(){ //función HTTP GET para consultar datos
    const supabase = await createClient() //crea cliente de Supabase usando sesión actual

    //Verificar que exista un usuario autenticado
    const{
        data: {user},
        error: authError,
    } = await supabase.auth.getUser() //obtener usuario desde Supabase Auth

    if(authError || !user){
        return NextResponse.json(
            {error: 'Usuario sin autenticación válida.'},
            {status: 401}
        )
    } //lanzar error si usuario no está autenticado

    //Consultar servicios permitidos para el usuario según políticas RLS
    const {data: servicios, error} = await supabase
        .from('servicios')
        .select(
            'id,nombre,descripcion,duracion_minutos,precio_clp,activo,creado_en'
        )
        .order('nombre', {ascending:true}) //ordenar servicios por nombre de A a Z

    //Mostrar error si falla la consulta a la tabla servicios
    if (error){
        return NextResponse.json(
            {error: error.message},
            {status: 500}
        )
    }

    //Devolver lista encontrada y cantidad total de servicios
    return NextResponse.json({
        servicios: servicios || [], //si no hay servicios devuelve arreglo vacío
        total: servicios?.length || 0,
    })
}


//CREAR SERVICIO
export async function POST(request: Request){
    try{
        const supabase = await createClient() //conectar con Supabase usando sesión actual

        //Verificar usuario antes de permitir crear un servicio
        const{
            data:{user},
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user){
            return NextResponse.json(
                {error: 'Usuario no autenticado'},
                {status: 401}
            )
        }

        //Leer los datos enviados por el formulario frontend
        const body = await request.json()

        const{
            nombre,
            descripcion,
            duracion_minutos,
            precio_clp,
        } = body

        //Validar que lleguen todos los campos obligatorios
        //La descripción es opcional
        if(
            !nombre ||
            duracion_minutos === undefined ||
            precio_clp === undefined
        ){
            return NextResponse.json(
                {
                    error: 'Ingrese nombre, duración y precio',
                },
                {status:400}
            )
        }

        //Convertir duración y precio a números
        //Un formulario puede enviarlos como texto aunque sean campos numéricos
        const duracion = Number(duracion_minutos)
        const precio = Number(precio_clp)

        //Validar duración como número entero positivo
        if (!Number.isInteger(duracion) || duracion <= 0) {
            return NextResponse.json(
                {
                    error:
                        'La duración debe ser un número entero mayor que 0',
                },
                {status: 400}
            )
        }

        //Validar precio como número entero positivo o igual a cero
        if (!Number.isInteger(precio) || precio < 0) {
            return NextResponse.json(
                {
                    error:
                        'El precio debe ser un número entero mayor o igual a 0',
                },
                {status: 400}
            )
        }

        //obtener la peluqueria asociada al usuario autenticado
        const {data:usuario, error:usuarioError} = await supabase
        .from('usuarios') //busca en usuarios
        .select('peluqueria_id') //selecciona la peluqueria que pertenece al usuario
        .eq('id',user.id) //compara id de tabla usuarios con el de supabase auth
        .single() //se espera un solo usuario

        //detener creacion si el usuarip no tiene peluqueria
        if(usuarioError || !usuario?.peluqueria_id){
            return NextResponse.json(
                {error: 'Usuario sin peluquería asociada'},
                {status:403}
            )
        }

        //limpiar espacios para guardar
        const nombreLimpio = String(nombre).trim()
        const descripcionLimpia = descripcion
            ? String(descripcion).trim()
            :null

        //evitar guardar nombre formado por espacios
        if(!nombreLimpio){
            return NextResponse.json(
                {error:'Ingrese un nombre válido'},
                {status: 400}
            )
        }

        //crear servicio y asociarlo a la peluqueria del usuario
        const {data:servicio, error:servicioError} = await supabase
            .from('servicios')
            .insert({
                peluqueria_id: usuario.peluqueria_id,
                nombre: nombreLimpio,
                descripcion: descripcionLimpia,
                duracion_minutos: duracion,
                precio_clp: precio,
                activo: true,
            }).select().single()

        //mostrar error si supabase no guarda el servicio
        if(servicioError){
            return NextResponse.json(
                {error: servicioError.message},
                {status: 500}
            )
        }

        //devolver servicio creado para que el frontend actualice la lista
        return NextResponse.json(
            {
                success: true,
                message: 'Servicio creado exitosamente',
                servicio,
            },
            {status: 201}
        )

    } catch (error){
        //Capturar errores inesperados del endpoint
        console.error('Error en POST /api/servicios:', error)

        return NextResponse.json(
            {error: 'Error interno del servidor'},
            {status: 500}
        )
    }
}
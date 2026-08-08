//hrm me tomé esta libertad pq crei necesario poder agregar o leiminar peluqueros en las peluquerias, y que el dueño del local pueda hacerlo, no??? en vez de hacerlo nosotros
//hay que agregar el boton de Peluqueros en el dashboard jejejeje
import { createClient } from "@/app/lib/supabase/server";
import { create } from "domain";
import { nextTest } from "next/dist/cli/next-test";
import { NextResponse } from "next/server";

//obtener peluqueros
export async function GET() {
    const supabase = await createClient() //conectar a supabase usando la sesion en uso

    //verificar al usuario antes de permitir consultar peluqueros
    const{
        data: {user},
        error: authError,
    } = await supabase.auth.getUser()

    if(authError || !user){ //id de autenticacion, si no la hay, tira mensaje de error
        return NextResponse.json(
            {error: 'Usuario no autenticado'},
            {status: 401}
        )
    }

    //consultar peluqueros permitidos para el usuario según politicas RLS
    const {data:peluqueros,error: peluquerosError} = await supabase
        .from('peluqueros') //de la tabla peluqueros
        .select('id,usuario_id,nombre,telefono,tipo_contrato,porcentaje_comision,color_agenda,activo,creado_en') //obtiene los datpsnecesarios para el frontend
        .order('nombre',{ascending: true}) //los ordena por orden alfabetico

    //detener la consulta si supabase no obtiene los peluqueros
    if(peluquerosError){
        return NextResponse.json(
            {error: peluquerosError.message},
            {status:500}
        )
    }

    //devolver lista de peluqueros y cantidad encontrada
    return NextResponse.json(
        {peluqueros: peluqueros || [],
            total: peluqueros?.length || 0,
        }
    )
}
//se puede probar entrando a: http://localhost:3000/api/peluqueros

//crear un peluquero
export async function POST(request: Request){
    try{
        const supabase = await createClient() //conectar usando sesión actual

        //verificar usuario antes de permitir crear peluquero
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

        //leer datos enviados desde el frontend
        const body = await request.json()
        const{
            nombre,
            telefono,
            tipo_contrato,
            porcentaje_comision,
            color_agenda,
        } = body

        //validar nombre obligatorio y eliminar espacios
        const nombreLimpio = nombre
            ? String(nombre).trim()
            : ''
        if(!nombreLimpio){
            return NextResponse.json(
                {error: 'Ingrese el nombre del peluquero'},
                {status: 400}
            )
        }

        //validar telefono como opcional
        const telefonoLimpio = telefono
            ? String(telefono).trim()
            : null //si no se agrega quedará como null
        
        //validar cantidad de digitos minima necesaria
        if(telefonoLimpio){
            const soloNumeros = telefonoLimpio.replace(/\D/g,'')
            if(soloNumeros.length < 8){
                return NextResponse.json(
                    {error: 'El número de teléfono debe tener al menos 8 dígitos'},
                    {status:400}
                )
            }
        }

        //calidar el tipo de contrato según los que permite la base de datos
        const contratosValidos = [
            'fijo',
            'comision',
            'arriendo_sillon',
        ]
        const contrato = tipo_contrato || 'fijo'
        if(!contratosValidos.includes(contrato)){
            return NextResponse.json(
                {error: 'Tipo de contrato inválido: Deber ser fijo, comision o arriendo_sillon'},
                {status: 400}
            )
        }

        //validar la comision
        //convertir comision a numero o utilizar 0 por defecto
        const comision = porcentaje_comision === undefined
            ? 0
            : Number(porcentaje_comision)
        //validar porcentaje entre 0 y 100
        if(!Number.isInteger(comision) || comision < 0 || comision > 100){
            return NextResponse.json(
                {error: 'El porcentaje de comisión deber ser un número entero entre 0 y 100'},
                {status: 400} //Ñañdú
            )
        }
        //usar comision solamente cuando el contrato sea de tipo comision
        const comisionFinal = contrato === 'comision'
            ? comision
            : 0

        //validar color de agenda
        //usar color por defecto si frontend no envia uno
        const color = color_agenda || '#3B82F6' //Mejor usar palabras? o paleta de color? peru mjr

        //validar color hexadecimal con formato #RRGGBB
        const formatoColor = /^#[0-9A-Fa-f]{6}$/
        if(!formatoColor.test(color)){
            return NextResponse.json(
                {error: 'El color de agenda debe usar formato hexadecimal, ejemplo: #3B82F6'},
                {status:400} //creo que es mejor que el usuario use una paleta de colores y que por dentro nosotros lo pasemos a hexadecimal y se guarde, no???
            )
        }

        //obtener pelu asociada al usuario autenticado
        const {data: usuario, error:usuarioError} = await supabase
            .from('usuarios')
            .select('peluqueria_id')
            .eq('id',user.id)
            .single()
        //detener creacion si usuario no tiene pelu asociá
        if(usuarioError || !usuario?.peluqueria_id){
            return NextResponse.json(
                {error: 'Usuario sin peluquería asociada'},
                {status: 403}
            )
        }

        //crear peluquero asociado a pelu del usuario
        const {data:peluquero, error:peluqueroError} = await supabase
            .from('peluqueros')
            .insert({
                peluqueria_id: usuario.peluqueria_id,
                usuario_id: null,
                nombre: nombreLimpio,
                telefono: telefonoLimpio,
                tipo_contrato: contrato,
                porcentaje_comision: comisionFinal,
                color_agenda: color,
                activo: true
            }).select().single()

        //mostrar error si supabase no consigue crear el peluquero
        if(peluqueroError){
            return NextResponse.json(
                {error: peluqueroError.message},
                {status: 500}
            )
        }

        //devolver respuesta exitosa para actualizar en frontend (peluquero creado)
        return NextResponse.json(
            {
                success: true,
                message: 'Peluquero creado con éxito.',
                peluquero,
            },
            {status: 201}
        )

    } catch(error) {
        console.error('Error en POST /api/peluqueros:', error)
        return NextResponse.json(
            {error: 'Error interno del servidor'},
            {status: 500} //ñ
        )
    }
}


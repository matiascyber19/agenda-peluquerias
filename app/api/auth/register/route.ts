import {NextResponse} from 'next/server'
import {createClient} from '@/app/lib/supabase/server'

export async function POST(request: Request){
    try{
        // 1.Lee los datos desde el frontend
        const body=await request.json()
        const {email,password,nombre_peluqueria,slug,nombre_usuario} = body

        //2.Validar SIN campos vacios
        if(!email || !password || !nombre_peluqueria || !slug || !nombre_usuario){
            return NextResponse.json(
                {error:'Complete los campos obligatorios'},
                {status:400}
            )
        }

        //3.Validar formato slug (solo minusculas, numeros y guiones)
        const slugValido = /^[a-z0-9-]+$/.test(slug)
        if(!slugValido){
            return NextResponse.json(
                {error: 'El formato slug solo permite minúsculas, números y guiones'},
                {status:400}
            )
        }
        //4.Validar contraseña por longitud
        if(password.length < 6){
            return NextResponse.json(
                {error:'La constraseña debe tener a lo menos 6 caracteres'},
                {status:400}
            )
        }
        const supabase = await createClient()

        //5.Crear usuario en Supabase Auth
        const {data:authData,error:signUpError} = await supabase.auth.signUp(
            {
            email,
            password,
            }
        )
        if(signUpError){
            return NextResponse.json(
                {error:signUpError.message},
                {status:400}
            )
        }
        if(!authData.user){
            return NextResponse.json(
                {error:'Error al crear usuario'},
                {status:500}
            )
        }

        //6.LLamar a funcion registrar_peluqueria() de la base de datos
        //Crea tenant + registro en tabla de usuarios
        const {data:peluqueriaId,error:rpcError}=await supabase.rpc(
            'registrar_peluqueria',
            {
                p_nombre_peluqueria: nombre_peluqueria,
                p_slug: slug,
                p_nombre_usuario: nombre_usuario,
            }
        )
        if(rpcError){
            //Si da error, se muestra el error pero el usuario se crea en Auth
            //Admin de Supabase debe manejar el reintento desde el frontend
            return NextResponse.json(
                {error:`Error al registrar peluquería: ${rpcError.message}`},
                {status:500}
            )
        }
        //7. Si esta todo BIEN...
        return NextResponse.json(
            {
                success:true,
                message: 'Cuenta creada correctamente',
                peluqueria_id: peluqueriaId,
                user_id: authData.user.id,
            }
        )
    }catch (error){
        console.error('Error en /api/auth/register:',error)
        return NextResponse.json(
            {error:'Error interno del servidor'},
            {status:500}
        )
    }
}

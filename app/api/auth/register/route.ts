import {NextResponse} from 'next/server'
import {createClient} from '@/app/lib/supabase/server'
import {urlDeConfirmacion} from '@/app/lib/cuentaPendiente'

// Crea la cuenta del dueño y su peluquería. Si el correo ya tiene una cuenta
// sin peluquería (por ejemplo, de una invitación que no se terminó o de un
// intento anterior), entra con esa contraseña y crea la peluquería con ella.
export async function POST(request: Request){
    try{
        // 1.Lee los datos desde el frontend
        const body=await request.json()
        const {password,nombre_peluqueria,slug,nombre_usuario} = body
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

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
        if(password.length < 8){
            return NextResponse.json(
                {error:'La contraseña debe tener al menos 8 caracteres'},
                {status:400}
            )
        }
        const supabase = await createClient()

        //5.Crear usuario en Supabase Auth, o entrar si el correo ya tiene uno
        //Si Supabase pide confirmar el correo, la peluquería se registra sola
        //al confirmar o al iniciar sesión (app/lib/cuentaPendiente.ts)
        const {data:authData,error:signUpError} = await supabase.auth.signUp(
            {
            email,
            password,
            options:{
                emailRedirectTo: urlDeConfirmacion(request),
                data:{registro_pendiente:{nombre_peluqueria,slug,nombre_usuario}},
            },
            }
        )
        if(signUpError){
            if(signUpError.code !== 'user_already_exists'){
                return NextResponse.json(
                    {error:mensajeDeRegistro(signUpError)},
                    {status:400}
                )
            }
            //5a.El correo ya tiene cuenta: se entra con ella
            const {error:entrarError} = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if(entrarError){
                return NextResponse.json(
                    {error:'Ese correo ya tiene una cuenta y la contraseña no coincide. Usa tu contraseña de siempre o recupérala desde el inicio de sesión.'},
                    {status:409}
                )
            }
        }else if(!authData.session){
            //5b.El RPC de abajo corre bajo RLS y necesita sesión activa.
            //signUp solo la devuelve si la confirmación de email está desactivada.
            const {error:signInError} = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if(signInError){
                //202: la cuenta existe y falta confirmar el correo
                return NextResponse.json(
                    {confirmar:true},
                    {status:202}
                )
            }
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
            //La cuenta queda creada: al reintentar con el mismo correo y
            //contraseña se entra con ella (paso 5a)
            if(/ya tiene una peluquería/.test(rpcError.message)){
                return NextResponse.json(
                    {error:'Esa cuenta ya pertenece a una peluquería. Entra con ella desde el inicio de sesión.'},
                    {status:409}
                )
            }
            if(rpcError.code === '23505'){
                return NextResponse.json(
                    {error:'Esa dirección ya la usa otra peluquería. Prueba con otra.'},
                    {status:409}
                )
            }
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

/** Errores de Supabase al crear la cuenta, en español. */
function mensajeDeRegistro(error: {code?: string; message: string}){
    if(error.code === 'weak_password') return 'Esa contraseña es muy débil. Prueba con una más larga.'
    if(error.code === 'email_address_invalid') return 'Ese correo no es válido. Revísalo.'
    if(error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit'){
        return 'Hubo demasiados intentos seguidos. Espera unos minutos y vuelve a intentarlo.'
    }
    return error.message
}

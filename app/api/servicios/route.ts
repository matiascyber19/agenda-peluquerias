import { createClient } from "@/app/lib/supabase/server"
import { NextResponse } from "next/server"

//obtener datos
export async function GET(){ //encontrar funcion de HTTP GET esperando operaciones 
    const supabase = await createClient() //crea cliente en supabase usando sesion actual

    const{
        data: {user},
        error: authError,
    } = await supabase.auth.getUser() //obtener usuario de auth supabase
    if(authError || !user){
        return NextResponse.json(
            {error: 'Usuario sin autenticación válida.'},
            {status: 401}
        )
    } //lanzar error si usuario de auth supabase no esta autenticado

    const {data: servicios, error}= await supabase.from('servicios').select(
        'id,nombre,descripcion,duracion_minutos,precio_clp,activo,creado_en'
    ).order('nombre', {ascending:true})
    if (error){
        return NextResponse.json(
            {error: error.message},
            {status: 500}
        )
    }
    return NextResponse.json({
        servicios: servicios || [],
        total: servicios?.length || 0,
    })
}
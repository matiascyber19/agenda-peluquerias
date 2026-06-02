import { createClient } from '@/app/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  //1.Recibe email y contraseña desde formulario
  const { email, password } = await request.json()

  //2.Conectar a Supabase
  const supabase = await createClient()

  // 3.Intenta login
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // 4.Si hay error, avisarle al frontend
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  // 5.Si todo ok, redirigir al panel
  return NextResponse.json({ ok: true })
}
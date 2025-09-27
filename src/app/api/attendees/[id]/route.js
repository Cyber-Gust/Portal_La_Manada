// app/api/attendees/[id]/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../lib/supabaseAdmin';

export async function PUT(req, { params }) {
  try {
    const id = params.id;
    const body = await req.json();

    const updates = {};
    ['name','phone','email','shirt_size','is_legendario','referral_source','notes'].forEach((k) => {
      if (body[k] !== undefined) updates[k] = body[k];
    });
    if (updates.phone) updates.phone = String(updates.phone).replace(/\D/g, '');
    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();

    const { data, error } = await sbAdmin.from('attendees').update(updates).eq('id', id).select().single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: 'Este e-mail já está cadastrado.' }, { status: 409 });
      }
      throw error;
    }
    if (!data) return NextResponse.json({ success: false, error: 'Registro não encontrado.' }, { status: 404 });

    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  try {
    const id = params.id;
    const { error } = await sbAdmin.from('attendees').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true, data: { id } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

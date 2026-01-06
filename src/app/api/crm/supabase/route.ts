export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const contactSchema = z.object({
  type: z.literal('contact'),
  name: z.string().min(1).max(200),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal(''))
})

const appointmentSchema = z.object({
  type: z.literal('appointment'),
  clientName: z.string().min(1).max(200),
  date: z.string(),
  time: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional()
})

const taskSchema = z.object({
  type: z.literal('task'),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string(),
  clientName: z.string().max(200).optional()
})

const crmSchema = z.union([contactSchema, appointmentSchema, taskSchema])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = crmSchema.parse(body)

    // Mock user ID for testing
    const userId = 'test-user-123'

    if (data.type === 'contact') {
      const contact = {
        id: `contact-${Date.now()}`,
        user_id: userId,
        client_name: data.name,
        client_email: data.email || null,
        client_phone: data.phone || null,
        title: 'Contact',
        description: data.notes || null,
        date: new Date().toISOString(),
        duration: 0,
        status: 'contact',
        created_at: new Date().toISOString()
      }

      return NextResponse.json({ ok: true, contact })

    } else if (data.type === 'appointment') {
      const appointmentDate = new Date(`${data.date}T${data.time}`)
      const appointment = {
        id: `appointment-${Date.now()}`,
        user_id: userId,
        client_name: data.clientName,
        title: data.title || 'Meeting',
        description: data.description || null,
        date: appointmentDate.toISOString(),
        duration: 60,
        status: 'scheduled',
        created_at: new Date().toISOString()
      }

      return NextResponse.json({ ok: true, appointment })

    } else {
      const task = {
        id: `task-${Date.now()}`,
        user_id: userId,
        client_name: data.clientName || '',
        title: data.title,
        description: data.description || null,
        date: new Date(data.dueDate).toISOString(),
        duration: 0,
        status: data.priority,
        created_at: new Date().toISOString()
      }

      return NextResponse.json({ ok: true, task })
    }

  } catch (error: any) {
    console.error('CRM POST error:', error)
    return NextResponse.json({ 
      ok: false, 
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Mock data for testing
    const mockContacts = [
      {
        id: 'contact-1',
        name: 'John Doe',
        email: 'john.doe@email.com',
        phone: '+91 98765 43210',
        notes: 'Corporate law consultation',
        createdAt: new Date().toISOString()
      },
      {
        id: 'contact-2',
        name: 'Jane Smith',
        email: 'jane.smith@company.com',
        phone: '+91 87654 32109',
        notes: 'Property dispute case',
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ]

    const mockAppointments = [
      {
        id: 'appointment-1',
        clientName: 'John Doe',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '10:00',
        type: 'Consultation',
        status: 'confirmed'
      },
      {
        id: 'appointment-2',
        clientName: 'Jane Smith',
        date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
        time: '14:30',
        type: 'Case Review',
        status: 'confirmed'
      }
    ]

    const mockTasks = [
      {
        id: 'task-1',
        title: 'Review contract documents',
        description: 'Review and analyze the merger agreement',
        priority: 'high',
        status: 'pending',
        dueDate: new Date(Date.now() + 259200000).toISOString(),
        clientName: 'John Doe'
      },
      {
        id: 'task-2',
        title: 'Prepare legal notice',
        description: 'Draft legal notice for property dispute',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(Date.now() + 432000000).toISOString(),
        clientName: 'Jane Smith'
      }
    ]

    return NextResponse.json({ 
      ok: true, 
      contacts: mockContacts, 
      appointments: mockAppointments, 
      tasks: mockTasks 
    })

  } catch (error: any) {
    console.error('CRM GET error:', error)
    return NextResponse.json({ 
      ok: false, 
      message: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
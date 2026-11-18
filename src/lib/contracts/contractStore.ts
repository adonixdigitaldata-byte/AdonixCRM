import fs from 'fs'
import path from 'path'
import { createServiceClient } from '@/lib/supabase/server'
import type { Contract } from '@/types/database'

const FALLBACK_FILE_PATH = path.join(process.cwd(), 'scratch', 'contracts-store.json')

function ensureFallbackFile(): Contract[] {
  try {
    const dir = path.dirname(FALLBACK_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    if (!fs.existsSync(FALLBACK_FILE_PATH)) {
      fs.writeFileSync(FALLBACK_FILE_PATH, JSON.stringify([]), 'utf8')
      return []
    }
    const data = fs.readFileSync(FALLBACK_FILE_PATH, 'utf8')
    return JSON.parse(data) || []
  } catch (err) {
    console.error('Error reading fallback contracts file:', err)
    return []
  }
}

function saveFallbackFile(contracts: Contract[]) {
  try {
    const dir = path.dirname(FALLBACK_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(FALLBACK_FILE_PATH, JSON.stringify(contracts, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing fallback contracts file:', err)
  }
}

export async function getAllContracts(): Promise<Contract[]> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('contracts')
      .select('*, client:clients(name, company, email, phone)')
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('relation "contracts" does not exist')) {
        console.warn('Supabase contracts table not found yet. Using local store fallback.')
        return ensureFallbackFile().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }
      throw error
    }
    return data || []
  } catch (err) {
    console.warn('Falling back to local contract store:', err)
    return ensureFallbackFile().sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }
}

export async function getContractById(id: string): Promise<Contract | null> {
  try {
    const supabase = await createServiceClient()
    const { data, error } = await supabase
      .from('contracts')
      .select('*, client:clients(*)')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('relation "contracts" does not exist')) {
        const local = ensureFallbackFile().find((c) => c.id === id)
        return local || null
      }
      throw error
    }
    if (data) return data
  } catch (err) {
    // ignore
  }

  // Check fallback store
  const localList = ensureFallbackFile()
  return localList.find((c) => c.id === id) || null
}

export async function getContractsByClientId(clientId: string, clientEmail?: string): Promise<Contract[]> {
  let clientName: string | null = null
  let clientCompany: string | null = null

  try {
    const supabase = await createServiceClient()
    const { data: client } = await supabase
      .from('clients')
      .select('name, company, email')
      .eq('id', clientId)
      .maybeSingle()

    if (client) {
      clientName = client.name
      clientCompany = client.company
      if (!clientEmail && client.email) clientEmail = client.email
    }

    const { data, error } = await supabase
      .from('contracts')
      .select('*, client:clients(*)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) return data
  } catch (err) {
    // ignore
  }

  const localList = ensureFallbackFile()
  return localList
    .filter((c) => {
      if (c.client_id === clientId) return true
      if (clientEmail && c.client_email && c.client_email.toLowerCase() === clientEmail.toLowerCase()) return true
      if (clientName && c.client_name && c.client_name.toLowerCase() === clientName.toLowerCase()) return true
      if (clientCompany && c.client_company && c.client_company.toLowerCase() === clientCompany.toLowerCase()) return true
      return false
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function saveContract(contract: Partial<Contract> & { client_name: string; service_title: string }): Promise<Contract> {
  const isNew = !contract.id
  const now = new Date().toISOString()
  const contractId = contract.id || crypto.randomUUID()

  // Generate contract number if not provided
  let contractNum = contract.contract_number
  if (!contractNum) {
    const count = ensureFallbackFile().length + 1001
    contractNum = `ADX-CTR-${count}`
  }

  const contractRecord: Contract = {
    id: contractId,
    contract_number: contractNum,
    client_id: contract.client_id || null,
    quotation_id: contract.quotation_id || null,
    client_name: contract.client_name,
    client_company: contract.client_company || null,
    client_email: contract.client_email || null,
    client_phone: contract.client_phone || null,
    client_address: contract.client_address || null,
    client_cr: contract.client_cr || null,
    client_vat: contract.client_vat || null,
    client_representative: contract.client_representative || null,
    service_title: contract.service_title,
    service_title_ar: contract.service_title_ar || contract.service_title,
    service_scope: contract.service_scope || '',
    service_scope_ar: contract.service_scope_ar || '',
    contract_price: Number(contract.contract_price) || 0,
    currency: contract.currency || 'SAR',
    tax_percent: Number(contract.tax_percent) || 15.0,
    tax_amount: Number(contract.tax_amount) || 0,
    total_with_tax: Number(contract.total_with_tax) || Number(contract.contract_price) || 0,
    billing_cycle: contract.billing_cycle || 'MONTHLY',
    payment_terms: contract.payment_terms || null,
    payment_terms_ar: contract.payment_terms_ar || null,
    term_duration: contract.term_duration || '1 Year',
    term_duration_ar: contract.term_duration_ar || 'سنة واحدة (١٢ شهراً)',
    start_date: contract.start_date || new Date().toISOString().split('T')[0],
    end_date: contract.end_date || null,
    office_location: contract.office_location || 'KSA',
    status: contract.status || 'DRAFT',
    signed_at: contract.signed_at || null,
    signed_by_name: contract.signed_by_name || null,
    signature_notes: contract.signature_notes || null,
    notes: contract.notes || null,
    created_by: contract.created_by || null,
    created_at: contract.created_at || now,
    updated_at: now,
  }

  // Try saving to Supabase first
  try {
    const supabase = await createServiceClient()
    if (isNew) {
      const { data, error } = await supabase
        .from('contracts')
        .insert(contractRecord)
        .select()
        .single()
      if (!error && data) {
        // Also sync local
        const local = ensureFallbackFile().filter((c) => c.id !== contractId)
        local.push(data)
        saveFallbackFile(local)
        return data
      }
    } else {
      const { data, error } = await supabase
        .from('contracts')
        .update(contractRecord)
        .eq('id', contractId)
        .select()
        .single()
      if (!error && data) {
        const local = ensureFallbackFile().filter((c) => c.id !== contractId)
        local.push(data)
        saveFallbackFile(local)
        return data
      }
    }
  } catch (err) {
    console.warn('Supabase save error, persisting to local fallback:', err)
  }

  // Fallback save
  const local = ensureFallbackFile().filter((c) => c.id !== contractId)
  local.push(contractRecord)
  saveFallbackFile(local)
  return contractRecord
}

export async function deleteContract(id: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient()
    await supabase.from('contracts').delete().eq('id', id)
  } catch (err) {
    // ignore
  }

  const local = ensureFallbackFile().filter((c) => c.id !== id)
  saveFallbackFile(local)
  return true
}


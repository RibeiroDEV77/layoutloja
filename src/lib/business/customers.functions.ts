/**
 * Server Functions: Customers (Fase 5.1).
 */
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { withBusiness } from './with-business';
import * as Svc from './services/customers.server';

export const listCustomers = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.ListCustomersInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.listCustomers(context.supabase, context.userId, data)));

export const getCustomer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.getCustomer(context.supabase, context.userId, data.id)));

export const createCustomer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.CreateCustomerInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.createCustomer(context.supabase, context.userId, data)));

export const updateCustomer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Svc.UpdateCustomerInput }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.updateCustomer(context.supabase, context.userId, data.id, data.patch)));

export const deleteCustomer = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.deleteCustomer(context.supabase, context.userId, data.id)));

export const revealCustomerDocument = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason?: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.revealCustomerDocument(context.supabase, context.userId, data.id, data.reason)));

// addresses
export const addCustomerAddress = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.AddressInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.addAddress(context.supabase, context.userId, data)));

export const updateCustomerAddress = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Partial<Svc.AddressInput> }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.updateAddress(context.supabase, context.userId, data.id, data.patch)));

export const deleteCustomerAddress = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.deleteAddress(context.supabase, context.userId, data.id)));

// contacts
export const addCustomerContact = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.ContactInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.addContact(context.supabase, context.userId, data)));

export const updateCustomerContact = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Partial<Svc.ContactInput> }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.updateContact(context.supabase, context.userId, data.id, data.patch)));

export const removeCustomerContact = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.removeContact(context.supabase, context.userId, data.id)));

// tax
export const upsertCustomerTaxProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.TaxProfileInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.upsertTaxProfile(context.supabase, context.userId, data)));

// credit
export const addCustomerCreditEntry = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Svc.CreditEntryInput) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.addCreditEntry(context.supabase, context.userId, data)));

export const getCustomerCreditLedger = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Svc.getCreditLedger(context.supabase, context.userId, data.customer_id)));

// ---------------- Customer Hub (5.1+) ----------------
import * as Hub from './services/customer-hub.server';

export const getCustomer360 = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.getCustomer360(context.supabase, context.userId, data.customer_id)));

export const getCustomerTimeline = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string; limit?: number; before?: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.getCustomerTimeline(context.supabase, context.userId, data)));

export const listCustomerTags = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { store_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.listTags(context.supabase, context.userId, data.store_id)));

export const upsertCustomerTag = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; store_id: string; name: string; color?: string | null }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.upsertTag(context.supabase, context.userId, data)));

export const deleteCustomerTag = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.deleteTag(context.supabase, context.userId, data.id)));

export const assignCustomerTags = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string; tag_ids: string[] }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.assignTags(context.supabase, context.userId, data)));

export const addCustomerNote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string; body: string; pinned?: boolean }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.addNote(context.supabase, context.userId, data)));

export const updateCustomerNote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; body?: string; pinned?: boolean }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.updateNote(context.supabase, context.userId, data)));

export const deleteCustomerNote = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.deleteNote(context.supabase, context.userId, data.id)));

export const updateCustomerConsents = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string; consents: Partial<Record<'marketing_email'|'marketing_sms'|'marketing_whatsapp'|'data_processing', boolean>>; source?: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.updateConsents(context.supabase, context.userId, data)));

export const setCustomerAddressGeolocation = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { address_id: string; latitude: number; longitude: number; provider: string; precision: 'rooftop'|'interpolated'|'approximate'|'city' }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.setAddressGeolocation(context.supabase, context.userId, data)));

export const recomputeCustomerScore = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { customer_id: string }) => d)
  .handler(withBusiness(async ({ data, context }) => Hub.recomputeScore(context.supabase, context.userId, data.customer_id)));

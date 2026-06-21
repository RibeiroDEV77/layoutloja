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

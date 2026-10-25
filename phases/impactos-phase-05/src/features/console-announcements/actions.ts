'use server';

import { revalidatePath } from 'next/cache';
import { consoleAction } from '@/lib/platform/support';
import { announcementIdSchema, announcementSchema } from './schema';

/** Banner shown to NGOs (all, or one plan) between two times. Write it in English and Hindi. */
export const saveAnnouncementAction = consoleAction(
  {
    roles: ['support'],
    schema: announcementSchema,
    audit: (i) => ({ action: 'announcement.saved', target: i.titleEn }),
  },
  async (input, ctx) => {
    const row = {
      title_en: input.titleEn,
      title_hi: input.titleHi || null,
      body_en: input.bodyEn || null,
      body_hi: input.bodyHi || null,
      tone: input.tone,
      plan_key: input.planKey || null,
      starts_at: new Date(input.startsAt).toISOString(),
      ends_at: new Date(input.endsAt).toISOString(),
    };
    const { error } = input.id
      ? await ctx.supabase.from('announcements').update(row).eq('id', input.id)
      : await ctx.supabase.from('announcements').insert(row);
    if (error) throw error;
    revalidatePath('/console/announcements');
    return null;
  },
);

export const endAnnouncementAction = consoleAction(
  { roles: ['support'], schema: announcementIdSchema, audit: (i) => ({ action: 'announcement.ended', target: i.id }) },
  async (input, ctx) => {
    const { error } = await ctx.supabase
      .from('announcements')
      .update({ ends_at: new Date().toISOString(), starts_at: new Date(Date.now() - 1000).toISOString() })
      .eq('id', input.id);
    if (error) throw error;
    revalidatePath('/console/announcements');
    return null;
  },
);

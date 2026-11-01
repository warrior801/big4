import { supabase } from './supabase';

// Every table in supabase/schema.sql. Keep the two lists in step.
export const STR_TABLES = [
  'str_lifts',
  'str_lift_state',
  'str_sessions',
  'str_sets',
  'str_prep_log',
  'str_pain_log',
  'str_body_weight',
  'str_measurements',
  'str_meals',
  'str_protein_log',
  'str_settings',
  'str_settings_log',
] as const;

// Asks each table for a row count (no data). A table that answers is there and readable.
export async function missingTables(): Promise<string[]> {
  const results = await Promise.all(
    STR_TABLES.map(async (t): Promise<string | null> => {
      const { error } = await supabase.from(t).select('id', { count: 'exact', head: true });
      return error ? t : null;
    }),
  );
  return results.filter((t): t is string => t !== null);
}

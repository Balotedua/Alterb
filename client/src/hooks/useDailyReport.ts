import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface DailyReport {
  id: string;
  report_date: string;
  content: string;
  created_at: string;
}

const KEY = (uid: string, date: string) => ['daily_reports', uid, date] as const;

export function useDailyReport(date: string) {
  const { user } = useAuth();
  return useQuery<DailyReport | null>({
    queryKey: KEY(user?.id ?? '', date),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('id, report_date, content, created_at')
        .eq('user_id', user!.id)
        .eq('report_date', date)
        .maybeSingle();
      if (error) throw error;
      return data as DailyReport | null;
    },
    enabled: !!user?.id,
  });
}

export function useSaveDailyReport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, reportDate }: { content: string; reportDate: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('daily_reports')
        .upsert(
          { user_id: user.id, content, report_date: reportDate },
          { onConflict: 'user_id,report_date' },
        )
        .select()
        .single();
      if (error) throw error;
      return data as DailyReport;
    },
    onSuccess: (_, { reportDate }) => {
      if (!user) return;
      qc.invalidateQueries({ queryKey: KEY(user.id, reportDate) });
    },
  });
}

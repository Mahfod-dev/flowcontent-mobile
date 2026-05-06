import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { Skill } from '../types';

export function useSkills() {
  const { user } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.token) return;
    setLoading(true);
    try {
      const data = await apiService.getSkills(user.token);
      setSkills(data.filter((s) => s.enabled));
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [user?.token]);

  useEffect(() => { load(); }, [load]);

  return { skills, loading, reload: load };
}

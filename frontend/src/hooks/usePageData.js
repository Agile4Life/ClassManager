import { useCallback, useEffect, useState } from 'react';

export function usePageData(loader, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.resolve(loader())
      .then((result) => active && setData(result))
      .catch((requestError) => active && setError(requestError.message || 'Không thể tải dữ liệu'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, refreshKey]);

  return { data, loading, error, refresh };
}

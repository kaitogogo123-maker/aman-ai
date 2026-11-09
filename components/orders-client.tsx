'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMessages, resolveLocale } from '@/lib/i18n';

// marketplace 订单结构(GET /profile/orders 的 Page<OrderDTO> content 项)。只取展示需要的字段。
interface ProductRef {
  id: number;
  name: string;
}
interface OrderDTO {
  id: number;
  orderPrice: number;
  productDTO: ProductRef | null; // country=kz
  productChDTO: ProductRef | null; // country=ch
  statusOfOrder: string;
  statusDate: string;
  amountOfProduct: number;
  photoUrl: string[];
  trackCode: string | null;
}
interface OrdersPage {
  content: OrderDTO[];
  last: boolean;
  number: number;
}

type Country = 'kz' | 'ch';
const PAGE_SIZE = 10;

export function OrdersClient({ locale }: { locale: string }) {
  const currentLocale = resolveLocale(locale);
  const t = getMessages(currentLocale).orders;

  const [country, setCountry] = useState<Country>('kz');
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [page, setPage] = useState(0);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<'' | 'load' | 'auth'>('');

  const load = useCallback(
    async (c: Country, p: number) => {
      if (p === 0) setOrders([]); // 切 tab / 重载:先清空旧数据
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/v1/orders?country=${c}&page=${p}&size=${PAGE_SIZE}`);
        if (res.status === 401) {
          setError('auth');
          setLoading(false);
          return;
        }
        if (!res.ok) {
          setError('load');
          setLoading(false);
          return;
        }
        const data = (await res.json()) as OrdersPage;
        const list = Array.isArray(data.content) ? data.content : [];
        setOrders((prev) => (p === 0 ? list : [...prev, ...list]));
        setLast(Boolean(data.last));
        setPage(p);
      } catch {
        setError('load');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    // load 内部会同步触发 setState(清空+loading),与 history-client 同款,按既有约定豁免
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(country, 0);
  }, [country, load]);

  function product(order: OrderDTO): ProductRef | null {
    return country === 'ch' ? order.productChDTO : order.productDTO;
  }

  return (
    <>
      <div className="history-head">
        <h1>{t.heading}</h1>
      </div>

      <div className="header-actions" role="group" style={{ marginBottom: '1rem' }}>
        <button type="button" className={`pill ${country === 'kz' ? 'active' : ''}`} onClick={() => setCountry('kz')}>
          {t.tabLocal}
        </button>
        <button type="button" className={`pill ${country === 'ch' ? 'active' : ''}`} onClick={() => setCountry('ch')}>
          {t.tabChina}
        </button>
      </div>

      {orders.length > 0 ? (
        <div className="orders-list">
          {orders.map((order) => {
            const p = product(order);
            const thumb = order.photoUrl?.[0];
            return (
              <article className="orders-row" key={order.id}>
                {thumb ? <img className="orders-thumb" src={thumb} alt="" loading="lazy" decoding="async" /> : null}
                <div className="orders-info">
                  <h2 className="orders-name">{p?.name ?? `#${order.id}`}</h2>
                  <div className="orders-meta">
                    <span>{t.priceLabel}: <b>{order.orderPrice.toLocaleString('ru-RU')} ₸</b></span>
                    <span>{t.statusLabel}: {order.statusOfOrder}</span>
                    <span>{t.qtyLabel}: {order.amountOfProduct}</span>
                    <span>{t.dateLabel}: {formatDate(order.statusDate, currentLocale)}</span>
                    {order.trackCode ? <span>{t.trackLabel}: {order.trackCode}</span> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <p className="muted">{t.loading}</p>
      ) : error === 'auth' ? (
        <p className="muted">{t.loginRequired}</p>
      ) : error === 'load' ? (
        <p className="muted">
          {t.loadError}{' '}
          <button type="button" className="history-retry" onClick={() => load(country, 0)}>
            {t.retry}
          </button>
        </p>
      ) : orders.length === 0 ? (
        <p className="muted">{t.empty}</p>
      ) : null}

      {!loading && !error && !last ? (
        <button type="button" className="button" onClick={() => load(country, page + 1)} style={{ marginTop: '1rem' }}>
          {t.loadMore}
        </button>
      ) : null}
    </>
  );
}

function formatDate(iso: string, locale: string) {
  try {
    return new Date(iso).toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return iso.slice(0, 10);
  }
}

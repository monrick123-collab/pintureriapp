import { useState, useEffect } from 'react';
import { SalesService } from '../services/salesService';
import { Sale } from '../types';
import { useUIStore } from '../store/uiStore';

type Period = 'today' | 'week' | 'fortnight' | 'month' | 'custom';

export const useSales = (branchId?: string) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const uiStore = useUIStore();

  const calculateDateRange = () => {
    const end = new Date();
    let start = new Date();
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    switch (period) {
      case 'today': break;
      case 'week':
        const day = start.getDay();
        start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
        break;
      case 'fortnight':
        start.setDate(start.getDate() - 15);
        break;
      case 'month':
        start.setDate(1);
        break;
      case 'custom':
        if (!customStart || !customEnd) return null;
        start = new Date(customStart);
        const endCustom = new Date(customEnd);
        endCustom.setHours(23, 59, 59, 999);
        return { start: start.toISOString(), end: endCustom.toISOString() };
    }
    return { start: start.toISOString(), end: end.toISOString() };
  };

  const fetchSales = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const range = calculateDateRange();
      if (!range) {
        setSales([]);
        return;
      }

      const data = await SalesService.getSalesWithFilters(
        range.start,
        range.end,
        branchId === 'ALL' ? undefined : branchId
      );
      
      setSales(data);
    } catch (err: any) {
      setError(err.message);
      uiStore.showToast('error', 'Error al cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [period, customStart, customEnd, branchId]);

  const totalSales = sales.reduce((acc, s) => acc + s.total, 0);
  const totalCash = sales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + s.total, 0);
  const totalCard = sales.filter(s => s.paymentMethod === 'card').reduce((acc, s) => acc + s.total, 0);
  const totalTransfer = sales.filter(s => s.paymentMethod === 'transfer').reduce((acc, s) => acc + s.total, 0);

  const getSalesByPaymentMethod = () => {
    return {
      cash: totalCash,
      card: totalCard,
      transfer: totalTransfer
    };
  };

  const getSalesByHour = () => {
    const salesByHour: Record<number, number> = {};
    
    sales.forEach(sale => {
      const hour = new Date(sale.createdAt).getHours();
      salesByHour[hour] = (salesByHour[hour] || 0) + sale.total;
    });
    
    return Object.entries(salesByHour)
      .map(([hour, total]) => ({ hour: parseInt(hour), total }))
      .sort((a, b) => a.hour - b.hour);
  };

  const getTopProducts = (limit = 5) => {
    const productSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.productName,
            quantity: 0,
            revenue: 0
          };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.total;
      });
    });
    
    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  };

  return {
    sales,
    loading,
    error,
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    fetchSales,
    totalSales,
    totalCash,
    totalCard,
    totalTransfer,
    getSalesByPaymentMethod,
    getSalesByHour,
    getTopProducts,
    salesCount: sales.length
  };
};
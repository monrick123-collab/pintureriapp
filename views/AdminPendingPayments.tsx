import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { User, UserRole, Sale } from '../types';
import { SalesService } from '../services/salesService';
import { PaymentExpiryService } from '../services/paymentExpiryService';

interface AdminPendingPaymentsProps {
  user: User;
  onLogout: () => void;
}

const AdminPendingPayments: React.FC<AdminPendingPaymentsProps> = ({ user, onLogout }) => {
  const [pendingSales, setPendingSales] = useState<Sale[]>([]);
  const [pendingMunicipalSales, setPendingMunicipalSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedMunicipalSale, setSelectedMunicipalSale] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMunicipalModal, setIsMunicipalModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPendingPayments();
    
    // Verificar y expirar pagos viejos al cargar
    const checkExpiredPayments = async () => {
      try {
        const result = await PaymentExpiryService.expireOldPendingPayments();
        if (result.expiredSales > 0 || result.expiredMunicipalSales > 0) {
          console.log(`Expiraron ${result.expiredSales + result.expiredMunicipalSales} pagos pendientes`);
          // Recargar si hubo cambios
          loadPendingPayments();
        }
      } catch (error) {
        console.error('Error checking expired payments:', error);
      }
    };
    
    checkExpiredPayments();
    
    // También archivar notificaciones viejas
    const archiveOldNotifications = async () => {
      try {
        await PaymentExpiryService.archiveOldNotifications();
      } catch (error) {
        console.error('Error archiving old notifications:', error);
      }
    };
    
    archiveOldNotifications();
    
    // Configurar intervalo para verificar cada hora
    const intervalId = setInterval(() => {
      checkExpiredPayments();
      // Archivar notificaciones cada 24 horas
      const now = new Date();
      if (now.getHours() === 3) { // A las 3 AM
        archiveOldNotifications();
      }
    }, 60 * 60 * 1000); // Cada hora
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const loadPendingPayments = async () => {
    try {
      setLoading(true);
      
      // Primero verificar si hay pagos que expiraron
      await PaymentExpiryService.expireOldPendingPayments();
      
      // Cargar ventas normales pendientes
      const sales = await SalesService.getPendingPayments();
      setPendingSales(sales);

      // Cargar ventas municipales pendientes usando el nuevo método
      console.log('Loading pending municipal payments for branch:', user.branchId);
      const pendingMunicipal = await SalesService.getPendingMunicipalPayments(user.branchId);
      console.log('Pending municipal payments found:', pendingMunicipal.length, pendingMunicipal);
      setPendingMunicipalSales(pendingMunicipal);
    } catch (error) {
      console.error('Error loading pending payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (saleId: string, isMunicipal: boolean = false) => {
    if (!confirm('¿Aprobar este pago? La venta será marcada como completada.')) return;
    
    try {
      setActionLoading(true);
      // Usar el método existente que acepta isMunicipal y adminId
      await SalesService.approvePayment(saleId, isMunicipal, user.id);
      alert('Pago aprobado correctamente');
      loadPendingPayments();
      setIsModalOpen(false);
    } catch (error: any) {
      alert('Error al aprobar pago: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (saleId: string, isMunicipal: boolean = false) => {
    if (!rejectionReason.trim()) {
      alert('Ingrese una razón para el rechazo');
      return;
    }
    
    if (!confirm('¿Rechazar este pago? Se notificará al vendedor.')) return;
    
    try {
      setActionLoading(true);
      // Usar el método existente que acepta isMunicipal y reason
      await SalesService.rejectPayment(saleId, isMunicipal, rejectionReason);
      alert('Pago rechazado correctamente');
      setRejectionReason('');
      loadPendingPayments();
      setIsModalOpen(false);
    } catch (error: any) {
      alert('Error al rechazar pago: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openSaleDetails = (sale: Sale, isMunicipal: boolean = false) => {
    if (isMunicipal) {
      setSelectedMunicipalSale(sale);
      setIsMunicipalModal(true);
    } else {
      setSelectedSale(sale);
      setIsMunicipalModal(false);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSale(null);
    setSelectedMunicipalSale(null);
    setRejectionReason('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (pendingSince: string) => {
    const { hoursRemaining, isExpired, isUrgent } = PaymentExpiryService.getTimeRemaining(pendingSince);
    
    if (isExpired) {
      return <span className="text-red-500 font-bold">EXPIRADO</span>;
    } else if (isUrgent) {
      return <span className="text-amber-500 font-bold">{hoursRemaining}h restantes ⚠️</span>;
    } else {
      return <span className="text-green-500">{hoursRemaining}h restantes</span>;
    }
  };

  const totalPending = pendingSales.length + pendingMunicipalSales.length;

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar user={user} onLogout={onLogout} />

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-background-dark">
        <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>Administración / Pagos Pendientes</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <span className="text-sm font-bold">
                {totalPending} {totalPending === 1 ? 'pago pendiente' : 'pagos pendientes'}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">Aprobación de Pagos</h2>
              <p className="text-slate-500 text-sm">Revisa y aprueba pagos pendientes de transferencia/efectivo. Tienes 48 horas para responder.</p>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : totalPending === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">check_circle</span>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No hay pagos pendientes</h3>
                <p className="text-slate-500 mt-2">Todos los pagos han sido procesados.</p>
              </div>
            ) : (
              <>
                {/* Ventas Normales (Mayoreo) */}
                {pendingSales.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200">Ventas de Mayoreo Pendientes</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {pendingSales.map(sale => (
                        <div key={sale.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  Venta #{sale.id.substring(0, 8)}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${sale.isWholesale ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                                  {sale.isWholesale ? 'Mayoreo' : 'Menudeo'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
                                  {sale.paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo'}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                  <p className="text-[10px] uppercase text-slate-500 font-bold">Monto</p>
                                  <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(sale.total)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-slate-500 font-bold">Cliente</p>
                                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{sale.clientName || 'No especificado'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-slate-500 font-bold">Tiempo Restante</p>
                                  <p className="text-sm font-bold">{sale.pendingSince ? getTimeRemaining(sale.pendingSince) : 'N/A'}</p>
                                </div>
                              </div>

                              {sale.transferReference && (
                                <div className="mb-3">
                                  <p className="text-[10px] uppercase text-slate-500 font-bold">Referencia de Transferencia</p>
                                  <p className="text-sm font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">{sale.transferReference}</p>
                                </div>
                              )}

                              <p className="text-xs text-slate-500">
                                Creada: {formatDate(sale.createdAt)}
                              </p>
                            </div>

                            <div className="flex flex-col gap-2 ml-4">
                              <button
                                onClick={() => openSaleDetails(sale, false)}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors"
                              >
                                Ver Detalles
                              </button>
                              <button
                                onClick={() => handleApprove(sale.id, false)}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                              >
                                Aprobar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ventas Municipales Pendientes */}
                {pendingMunicipalSales.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200">Ventas Municipales Pendientes</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {pendingMunicipalSales.map(sale => (
                        <div key={sale.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  Venta Municipal #{sale.folio}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-700">
                                  Municipal
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
                                  {sale.payment_method === 'transfer' ? 'Transferencia' : 'Efectivo'}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                  <p className="text-[10px] uppercase text-slate-500 font-bold">Monto</p>
                                  <p className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(sale.total)}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-slate-500 font-bold">Municipio</p>
                                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{sale.municipality}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase text-slate-500 font-bold">Tiempo Restante</p>
                                  <p className="text-sm font-bold">{sale.pending_since ? getTimeRemaining(sale.pending_since) : 'N/A'}</p>
                                </div>
                              </div>

                              {sale.transfer_reference && (
                                <div className="mb-3">
                                  <p className="text-[10px] uppercase text-slate-500 font-bold">Referencia de Transferencia</p>
                                  <p className="text-sm font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded-lg">{sale.transfer_reference}</p>
                                </div>
                              )}

                              <p className="text-xs text-slate-500">
                                Creada: {formatDate(sale.created_at)}
                              </p>
                            </div>

                            <div className="flex flex-col gap-2 ml-4">
                              <button
                                onClick={() => openSaleDetails(sale, true)}
                                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors"
                              >
                                Ver Detalles
                              </button>
                              <button
                                onClick={() => handleApprove(sale.id, true)}
                                disabled={actionLoading}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                              >
                                Aprobar
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal de Detalles */}
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                <h3 className="font-black text-xl text-slate-900 dark:text-white">
                  {isMunicipalModal ? 'Detalles Venta Municipal' : 'Detalles Venta'}
                </h3>
                <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto">
                {isMunicipalModal && selectedMunicipalSale ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Municipio</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedMunicipalSale.municipality}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Folio</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">#{selectedMunicipalSale.folio}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Monto Total</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(selectedMunicipalSale.total)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Método de Pago</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {selectedMunicipalSale.payment_method === 'transfer' ? 'Transferencia' : 
                           selectedMunicipalSale.payment_method === 'cash' ? 'Efectivo' : 
                           selectedMunicipalSale.payment_method}
                        </p>
                      </div>
                    </div>

                    {selectedMunicipalSale.transfer_reference && (
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Referencia de Transferencia</p>
                        <p className="text-sm font-mono bg-slate-100 dark:bg-slate-900 p-3 rounded-xl">{selectedMunicipalSale.transfer_reference}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">Razón para Rechazo</p>
                      <textarea
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm h-32 resize-none"
                        placeholder="Ingrese la razón para rechazar este pago..."
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => handleReject(selectedMunicipalSale.id, true)}
                        disabled={actionLoading || !rejectionReason.trim()}
                        className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Rechazar Pago
                      </button>
                      <button
                        onClick={() => handleApprove(selectedMunicipalSale.id, true)}
                        disabled={actionLoading}
                        className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl shadow-xl disabled:opacity-50 transition-all"
                      >
                        Aprobar Pago
                      </button>
                    </div>
                  </div>
                ) : selectedSale && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">ID Venta</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedSale.id.substring(0, 12)}...</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Tipo</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{selectedSale.isWholesale ? 'Mayoreo' : 'Menudeo'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Monto Total</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(selectedSale.total)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Método de Pago</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">
                          {selectedSale.paymentMethod === 'transfer' ? 'Transferencia' : 
                           selectedSale.paymentMethod === 'cash' ? 'Efectivo' : 
                           selectedSale.paymentMethod}
                        </p>
                      </div>
                    </div>

                    {selectedSale.transferReference && (
                      <div>
                        <p className="text-[10px] uppercase text-slate-500 font-bold">Referencia de Transferencia</p>
                        <p className="text-sm font-mono bg-slate-100 dark:bg-slate-900 p-3 rounded-xl">{selectedSale.transferReference}</p>
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] uppercase text-slate-500 font-bold mb-2">Razón para Rechazo</p>
                      <textarea
                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm h-32 resize-none"
                        placeholder="Ingrese la razón para rechazar este pago..."
                        value={rejectionReason}
                        onChange={e => setRejectionReason(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={() => handleReject(selectedSale.id, false)}
                        disabled={actionLoading || !rejectionReason.trim()}
                        className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Rechazar Pago
                      </button>
                      <button
                        onClick={() => handleApprove(selectedSale.id, false)}
                        disabled={actionLoading}
                        className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl shadow-xl disabled:opacity-50 transition-all"
                      >
                        Aprobar Pago
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPendingPayments;
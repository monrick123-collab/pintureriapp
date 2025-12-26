
import { Product, UserRole, User, FinancialInvoice, Client, Branch } from './types';

export const MOCK_USER: User = {
  id: '4829',
  name: 'Juan Pérez',
  email: 'juan.perez@pintamax.com',
  role: UserRole.SELLER,
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCqzqjE92fmheEpEczxTqJWluCopR0gTexAmLRJ-zcyKONanzYxVAfuhPPDkakFqCAT_CWP8lcsFbtdZR21CtzlPCoBnetqdCx9NA9PrQDJNTHMdgesw62auo9qcE56oBP8ZrLiLfqf7ztwkjj53jRfsMxsruqk_ywr-smJjlS_JYjocwRg_uc9NukGBqKEnxpGnXA5wkuzQ8BfE_OMkYln8hoTVeinp7pjIpie-4blhF8pMOxgb2DW2noHIoF1C8o1iK7jLTpLQS0',
  branchId: 'BR-CENTRO' // Default assigned branch
};

export const MOCK_WAREHOUSE_USER: User = {
  id: 'WH-001',
  name: 'Encargado de Bodega',
  email: 'bodega@pintamax.com',
  role: UserRole.WAREHOUSE,
  avatar: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
  branchId: 'BR-MAIN' // Bodega Principal
};

export const MOCK_BRANCHES: Branch[] = [
  { id: 'BR-MAIN', name: 'Bodega Principal (Hub)', address: 'Zona Industrial Vallejo', manager: 'Ing. Roberto Maya', phone: '555-1000', status: 'active', type: 'warehouse' },
  { id: 'BR-CENTRO', name: 'Sucursal Centro', address: 'Av. Juárez 45, Col. Centro', manager: 'Marta Sánchez', phone: '555-2000', status: 'active', type: 'store' },
  { id: 'BR-NORTE', name: 'Sucursal Norte', address: 'Plaza Satélite Local 12', manager: 'Pedro Infante', phone: '555-3000', status: 'active', type: 'store' },
  { id: 'BR-SUR', name: 'Sucursal Sur', address: 'Perisur Nivel 2', manager: 'Lucía Méndez', phone: '555-4000', status: 'active', type: 'store' },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    sku: 'VN-ADV-WH-01',
    name: 'Vinil Premium Blanca 4L',
    category: 'Interiores',
    description: 'Cubeta Plástica',
    price: 1200,
    stock: 215,
    inventory: { 'BR-MAIN': 150, 'BR-CENTRO': 25, 'BR-NORTE': 30, 'BR-SUR': 10 },
    status: 'available',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBobmQqh7Oa-jCojPhZs2_OvCvYURSMCC234KOWH1jg7Y2v1JDVIkLDGS73_8Pw_MF5O9AFhzP5634IzRTi6751LKCFkTX8RMDSmuRt070NxV7uAJY_Y_lL8jQg9Cn3tb1FdapQ3ZlNw6RH0uBlW81TvAguAHYzgdgVRRDqAs2BbMA2ZvjrXHdMugbJtuNteTSUxpU3h4HJNM1cwjumKUUPA_NVh0K010111Qx4XQ47_techIsApQvH9qirTIEiIbERvz963hv16vc'
  },
  {
    id: '2',
    sku: 'ES-RED-400',
    name: 'Esmalte Rojo Secado Rápido',
    category: 'Esmaltes',
    description: 'Aerosol 400ml',
    price: 150,
    stock: 62,
    inventory: { 'BR-MAIN': 50, 'BR-CENTRO': 2, 'BR-NORTE': 5, 'BR-SUR': 5 },
    status: 'low',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5QR295XwP06xhH63Cjm_jPucbojbpEifsdY6GPRF3tnJT8RYGrKfgtCAXfcJf-Z6tMKBWOqynt_g2-RsxhnpaVz6usz87xBggEdqea3NDaPb0_JR2pqW36XdKrPcnKPG53sqvoHDo04t77Rx1wQexQffGyiMD8oRRETHDGh7x2diXpyEwM1TwioIQLKKoweCKHATUWp9PY6rcj7H6Q_jQMkjQHZiwOjrpVtY_OmSI-N381n3h3dD7zRFJXBJiUNmdj4tGHVDXnUI'
  },
  {
    id: '3',
    sku: 'ROD-MF-9',
    name: 'Rodillo Microfibra 9"',
    category: 'Accesorios',
    description: 'Accesorio profesional',
    price: 120,
    stock: 300,
    inventory: { 'BR-MAIN': 200, 'BR-CENTRO': 40, 'BR-NORTE': 30, 'BR-SUR': 30 },
    status: 'available',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB11Gi_wQTPw3sylUt2iydydD_mPZColvfmo3Aipyb4P3lQzPgnrnbhYx8OTOv0djHKcRqp8UrNMzJ98eDFpTvNKeIihlNGRdMBUpxNbPlv9fZODXD8Ubh1TCg0ZQwaCooAwzSfhghzqM4v_3XOXyr9j8nRGXAdFIQ8PEmJtw_DyDUKv_QcaLoB6keV6XddX_v_Qybl-3ocH48eG3HF4E1dosLEi_1NsMd7AiGi8RGkmib7IJ9UIriiQFQ0Dsn3pfeGveBUCKOq-Y8'
  }
];
// MOCK_FINANCES and MOCK_CLIENTS remain the same
export const MOCK_CLIENTS: Client[] = [
  {
    id: 'CL-001',
    name: 'Constructora ABC',
    email: 'contacto@abc.com',
    phone: '555-0192',
    taxId: 'CAB901010-ABC',
    address: 'Av. Reforma 100, CDMX',
    type: 'Empresa'
  },
  {
    id: 'CL-002',
    name: 'Ricardo Salinas',
    email: 'ricardo.s@gmail.com',
    phone: '555-9821',
    taxId: 'SAR850202-XYZ',
    address: 'Calle Luna 45, Satélite',
    type: 'Individual'
  }
];

export const MOCK_FINANCES: FinancialInvoice[] = [
  {
    id: 'INV-2023-001',
    counterparty: 'Construcciones Pérez',
    counterpartyId: 'RFC: CPE890101',
    issueDate: '12 Oct 2023',
    dueDate: '25 Oct 2023',
    status: 'overdue',
    amount: 12450.00,
    branch: 'Sucursal Norte',
    colorCode: 'CP'
  },
  {
    id: 'INV-2023-045',
    counterparty: 'Inmobiliaria Muebles',
    counterpartyId: 'RFC: IMU902020',
    issueDate: '15 Oct 2023',
    dueDate: '30 Oct 2023',
    status: 'pending',
    amount: 8200.00,
    branch: 'Sucursal Centro',
    colorCode: 'IM'
  }
];

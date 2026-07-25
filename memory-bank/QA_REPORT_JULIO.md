{\rtf1\ansi\ansicpg1252\cocoartf2870
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\froman\fcharset0 TimesNewRomanPS-BoldMT;\f1\froman\fcharset0 TimesNewRomanPSMT;\f2\fswiss\fcharset0 Arial-BoldMT;
\f3\fswiss\fcharset0 Helvetica;\f4\froman\fcharset0 TimesNewRomanPS-ItalicMT;\f5\fswiss\fcharset0 ArialMT;
\f6\fnil\fcharset128 HiraginoSans-W3;}
{\colortbl;\red255\green255\blue255;\red24\green30\blue42;\red88\green94\blue109;\red14\green18\blue29;
\red255\green255\blue255;\red0\green0\blue0;\red168\green8\blue22;}
{\*\expandedcolortbl;;\cspthree\c12978\c15986\c21128;\cspthree\c42495\c44613\c49700;\cspthree\c7218\c9330\c14841;
\csgray\c100000;\csgray\c0;\cspthree\c66554\c18050\c15048;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0

\f0\b\fs39\fsmilli19875 \cf2 Reporte de Bugs \'97 Perfiles Bodega y Encargado\

\f1\b0\fs21 \cf3 Julio 2026\
\cf4 El documento est\'e1 organizado en cuatro bloques: (A) bugs confirmados que afectan inventario o dinero, (B) mejoras de\
formato y visualizaci\'f3n, (C) una solicitud de funcionalidad nueva, y (D) dudas de proceso que conviene aclarar antes\
de seguir probando.\

\f0\b\fs30 \cf2 A.
\f2  
\f0 Bugs confirmados (prioridad alta)\

\f1\b0\fs21 \cf4 Estos afectan directamente el inventario o los montos. Se recomienda corregirlos antes de seguir probando otros\
m\'f3dulos que dependen de estos datos.\

\f0\b\fs20\fsmilli10125 \cf5 A1 
\fs24 \cf2 Resurtido genera inventario fantasma (duplica stock)\

\fs17\fsmilli8625 \cf5 CAUSA RA\'cdZ CONFIRMADA\

\fs18 \cf3 M\'f3dulo
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Resurtidos\

\f0\b \cf3 Funci\'f3n afectada
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 create_shipping_order (falta un par\'e1metro en la llamada del frontend)\

\f0\b \cf3 Casos de prueba
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 #R-0034, #R-0035, #R-0041\

\f0\b\fs20\fsmilli10125 \cf2 Qu\'e9 se prob\'f3\

\f1\b0\fs21 \cf4 Se gener\'f3 una solicitud de resurtido para Sucursal Centro (folio #R-0041, 3 productos por un total de $1,620). El\
administrador la autoriz\'f3 y, al intentar registrar el env\'edo desde el panel de Bodega, el sistema arroj\'f3 el siguiente error:\

\f3\fs18 \cf7 Error al crear env\'edo: Could not find the function public.create_shipping_order(p_carrier,\
p_created_by, p_entity_id, p_entity_type, p_notes, p_origin_branch_id, p_tracking_number) in the\
schema cache\

\f4\i\fs17\fsmilli8625 \cf3 Folio #R-0041: solicitud con 3 productos, autorizada y lista para enviar.\
Error al registrar el env\'edo desde el panel de Bodega.\

\f0\i0\b\fs20\fsmilli10125 \cf2 Causa exacta\

\f1\b0\fs21 \cf4 Al comparar los par\'e1metros que espera la funci\'f3n en la base de datos contra los que el frontend efectivamente env\'eda,\
falta uno: p_destination_branch_id (la sucursal destino). Como la funci\'f3n no recibe ese dato, el registro de env\'edo nunca\
se completa, y el descuento de inventario en Bodega Principal \'97que depende de ese paso\'97 tampoco ocurre.\

\f0\b\fs20\fsmilli10125 \cf2 Efecto en cascada, ya confirmado\

\f1\b0\fs15\fsmilli7875 \cf3 P\'e1gina 1 de 8
\f3\fs24 \cf0 \page 
\f1\fs15\fsmilli7875 \cf3 Perfiles Bodega y Encargado\

\fs21 \cf4 A pesar de ese error, el flujo no se detiene por completo: el encargado de la sucursal s\'ed puede continuar y confirmar la\
recepci\'f3n del pedido, capturando las cantidades recibidas.\

\f4\i\fs17\fsmilli8625 \cf3 El encargado s\'ed puede confirmar la recepci\'f3n, incluso sin que bodega haya registrado el env\'edo correctamente.\

\f1\i0\fs21 \cf4 Esa confirmaci\'f3n s\'ed ejecuta el movimiento de inventario, pero \'fanicamente del lado de la sucursal: si ten\'eda 10 piezas y\
se recibieron otras 10, el sistema las suma correctamente a 20. El inventario de Bodega Principal, en cambio, se queda\
exactamente igual que antes.\

\f0\b\fs20\fsmilli10125 \cf2 Consecuencia\

\f1\b0\fs21 \cf4 El resultado no es solo que el inventario quede desincronizado \'97 es que se genera inventario que no existe f\'edsicamente.\
Cada vez que se complete un resurtido bajo esta condici\'f3n, la sucursal ganar\'e1 stock que nunca sali\'f3 de bodega, y ese\
excedente se ir\'e1 acumulando con cada operaci\'f3n repetida.\

\f0\b\fs20\fsmilli10125 \cf2 Sugerencia\

\f1\b0\fs21 \cf4 Agregar el par\'e1metro p_destination_branch_id a la llamada que hace el frontend al registrar el env\'edo. Adicionalmente,\
ser\'eda conveniente que el sistema no permita avanzar a la confirmaci\'f3n de recepci\'f3n si el paso de env\'edo no se complet\'f3\
con \'e9xito, para evitar que este tipo de error pase desapercibido en producci\'f3n.\

\f0\b\fs24 \cf2 Dos rutas distintas para completar una solicitud (riesgo de confusi\'f3n)\

\fs20\fsmilli10125 \cf5 A2 
\fs18 \cf3 M\'f3dulo
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Resurtidos \'97 panel Bodega y panel Encargado\

\f0\b \cf3 S\'edntoma
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Existen dos acciones distintas que parecen hacer lo mismo, pero no lo hacen\

\fs21 En ambos paneles, cada solicitud tiene dos posibles acciones para avanzarla: un \'edcono r\'e1pido (la palomita en el panel de\
Encargado, o el cami\'f3n en el panel de Bodega) y el \'edcono de ojo en ambos que abre un modal con el detalle completo.\

\f4\i\fs17\fsmilli8625 \cf3 Panel Encargado: folio en camino, con \'edcono de palomita disponible\
junto al ojo.
\f1\i0\fs20\fsmilli10125 \cf6  
\f4\i\fs17\fsmilli8625 \cf3 Panel Bodega: folio pendiente, con \'edcono de cami\'f3n disponible junto al\
ojo.\

\f0\i0\b\fs20\fsmilli10125 \cf2 Lo que se confirm\'f3 al probarlo\

\f1\b0\fs21 \cf4 El \'edcono r\'e1pido (palomita o cami\'f3n) \'fanicamente registra la hora de salida o llegada \'97 no ejecuta ning\'fan movimiento\
de inventario. La funci\'f3n que s\'ed mueve el stock (o falla, como en el bug A1) solo se dispara desde el modal que abre el\
\'edcono de ojo.\

\f0\b\fs20\fsmilli10125 \cf2 Por qu\'e9 esto es un riesgo\

\f1\b0\fs21 \cf4 Al ser dos acciones visualmente similares y colocadas una junto a la otra, es razonable que cualquier persona operando\
el sistema use el \'edcono r\'e1pido pensando que con eso complet\'f3 el proceso \'97 ya que no hay ning\'fan mensaje de error ni\

\fs15\fsmilli7875 \cf3 P\'e1gina 2 de 8
\f3\fs24 \cf0 \page 
\f1\fs15\fsmilli7875 \cf3 Perfiles Bodega y Encargado\

\fs21 \cf4 advertencia que le indique lo contrario. El inventario simplemente nunca se mover\'eda, sin que nadie lo note en el\
momento.\

\f0\b\fs20\fsmilli10125 \cf2 Sugerencia\

\f1\b0\fs21 \cf4 Unificar ambas acciones en un solo bot\'f3n por solicitud: que el \'edcono principal (palomita o cami\'f3n) sea el que dispare\
todo el proceso completo \'97registro de horas y movimiento de inventario\'97, abriendo el modal de captura de\
cantidades. Esto simplifica la experiencia y elimina la ruta que hoy deja al inventario sin actualizar.\

\f0\b\fs24 \cf2 Las devoluciones no actualizan el inventario en ning\'fan sentido\

\fs20\fsmilli10125 \cf5 A3 
\fs18 \cf3 M\'f3dulo
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Devoluciones (sucursal \uc0\u8594  bodega)\

\f0\b \cf3 S\'edntoma
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Ni la sucursal disminuye su stock al devolver, ni bodega lo aumenta al confirmar la llegada\

\f0\b\fs20\fsmilli10125 \cf2 Qu\'e9 se prob\'f3\

\f1\b0\fs21 \cf4 Un encargado de sucursal registr\'f3 la devoluci\'f3n de varios productos hacia Bodega Principal.\

\f4\i\fs17\fsmilli8625 \cf3 Registro de la devoluci\'f3n desde la sucursal, con los productos y cantidades a devolver.\

\f1\i0\fs21 \cf4 El sistema no descont\'f3, en ese momento, las cantidades devueltas del inventario de la sucursal \'97 se mantuvo el mismo\
stock que antes de iniciar la devoluci\'f3n. Despu\'e9s, el administrador confirm\'f3 que el material s\'ed hab\'eda llegado\
f\'edsicamente a bodega:\

\f4\i\fs17\fsmilli8625 \cf3 Confirmaci\'f3n de llegada del material devuelto, desde el panel de administraci\'f3n.\

\f1\i0\fs21 \cf4 Tras esa confirmaci\'f3n, se verific\'f3 el inventario tanto en la sucursal de origen como en Bodega Principal, y ninguno de\
los dos hab\'eda cambiado: la sucursal segu\'eda con el stock de antes de la devoluci\'f3n (nunca baj\'f3), y bodega tampoco\
reflej\'f3 la entrada del material devuelto (nunca subi\'f3).\

\fs15\fsmilli7875 \cf3 P\'e1gina 3 de 8
\f3\fs24 \cf0 \page 
\f1\fs15\fsmilli7875 \cf3 Perfiles Bodega y Encargado\

\f4\i\fs17\fsmilli8625 Inventario de la sucursal despu\'e9s de confirmar: sin cambios.
\f1\i0\fs20\fsmilli10125 \cf6  
\f4\i\fs17\fsmilli8625 \cf3 Inventario de bodega despu\'e9s de confirmar: tampoco cambia.\

\f0\i0\b\fs20\fsmilli10125 \cf2 Un dato importante para acotar el bug\

\f1\b0\fs21 \cf4 En la misma prueba, al devolver botellas de thinner, el inventario s\'ed se ajust\'f3 correctamente en ambas sucursales \'97\
disminuy\'f3 en origen y aument\'f3 en bodega como se esperar\'eda. Esto sugiere que el bug no afecta a todas las\
devoluciones por igual, sino que podr\'eda depender del tipo de producto o de alguna configuraci\'f3n particular (por\
ejemplo, si el producto tiene o no relaci\'f3n con inventario a granel).\
Una sugerencia es que el dise\'f1o de la nota, tengo los mismos datos que la nota de vente municipal.\
Se recomienda que tengo los datos de: Cantidad, Concepto,\
Precio Unitario e Importe.\

\f0\b\fs20\fsmilli10125 \cf5 A4 
\fs24 \cf2 Consulta de stock por sucursal muestra 0 aunque s\'ed haya existencia\

\fs17\fsmilli8625 \cf5 CONFIRMADO EN INTERFAZ\

\fs18 \cf3 M\'f3dulo
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Consultar Stock por Sucursal\
(panel Bodega)\

\f0\b \cf3 S\'edntoma\

\f1\b0 \cf4 Todas las sucursales marcan\
0 / Agotado, excepto Bodega\
Principal\

\f0\b \cf3 Producto de prueba
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Vinimex Total Blanco\
(PINT-VIN-BLA)\

\fs15\fsmilli7875 \cf3 P\'e1gina 4 de 8
\f3\fs24 \cf0 \page 
\f1\fs15\fsmilli7875 \cf3 Perfiles Bodega y Encargado\

\f4\i\fs17\fsmilli8625 En el detalle de Sucursal Centro,
\f1\i0\fs20\fsmilli10125 \cf6  
\f4\i\fs17\fsmilli8625 \cf3 el mismo producto\
s\'ed tiene 1 pieza en existencia.\
Consulta general: todas las sucursales en 0, solo\
Bodega Principal marca 144.\

\f1\i0\fs21 \cf4 El comparativo entre ambas pantallas confirma que la consulta general no est\'e1 leyendo el stock real de cada sucursal,\
sino que parece mostrar siempre el valor de Bodega Principal. Falta revisar el c\'f3digo de esa consulta para confirmar la\
causa exacta.\

\f0\b\fs20\fsmilli10125 \cf5 A5 
\fs24 \cf2 No se puede liquidar una cuenta de cr\'e9dito por completo\

\fs18 \cf3 M\'f3dulo
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Cuentas de cr\'e9dito (Mayoreo y Municipio)\

\f0\b \cf3 S\'edntoma
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 Al usar "Pago completo" / "Liquidar deuda", marca error de monto inv\'e1lido\

\f0\b \cf3 Mensaje exacto
\f1\b0\fs20\fsmilli10125 \cf6  
\fs18 \cf4 "Ingrese un monto mayor a cero \'97 Monto inv\'e1lido"\

\f4\i\fs17\fsmilli8625 \cf3 El registro de abono parcial s\'ed funciona; el de liquidaci\'f3n completa no.\

\f1\i0\fs21 \cf4 Es probable que, al elegir "Pago completo", el formulario no est\'e9 enviando el monto total de la deuda como valor del\
campo (posiblemente lo deja vac\'edo o en 0, asumiendo que el sistema calcular\'e1 el resto autom\'e1ticamente), y la\
validaci\'f3n del backend lo rechaza por no ser mayor a cero.\

\f0\b\fs20\fsmilli10125 \cf5 A6 
\fs24 \cf2 Error al imprimir nota desde el historial de venta mayoreo\

\f4\i\b0\fs17\fsmilli8625 \cf3 Mensaje: "Error: No se encontr\'f3 la venta."\

\f1\i0\fs21 \cf4 Ocurre al intentar imprimir la nota de una venta ya registrada en el historial de mayoreo. Falta confirmar si sucede con\
todas las ventas del historial o solo con algunas (por ejemplo, ventas antiguas o en cierto estado).\

\fs15\fsmilli7875 \cf3 P\'e1gina 5 de 8
\f3\fs24 \cf0 \page 
\f1\fs15\fsmilli7875 \cf3 Perfiles Bodega y Encargado\

\f0\b\fs30 \cf2 B. Mejoras de formato y visualizaci\'f3n (prioridad media)\

\f1\b0\fs21 \cf4 No afectan datos ni dinero \'97 son ajustes de presentaci\'f3n que facilitar\'edan el uso diario.\

\f0\b\fs24 \cf2 Nota de resurtido sin precio unitario ni subtotal\

\fs20\fsmilli10125 \cf5 B1 
\f4\i\b0\fs17\fsmilli8625 \cf3 La nota de resurtido actual solo muestra cantidad, sin desglose de costos.\
Formato de referencia: nota de venta municipal, con columnas Precio Unit. / Cant. / Importe.\

\f1\i0\fs21 \cf4 Se sugiere replicar ese mismo orden en la nota de resurtido: Cantidad, Concepto, Precio Unitario e Importe. El dato ya\
existe en la base de datos (restock_items s\'ed guarda unit_price y total_price); solo falta mostrarlo en la plantilla de\
impresi\'f3n.\

\f0\b\fs20\fsmilli10125 \cf5 B2 
\fs24 \cf2 Impresi\'f3n de notas: se corta o sale muy peque\'f1a\

\f4\i\b0\fs17\fsmilli8625 \cf3 Vista previa de impresi\'f3n del corte de caja \'97 el contenido no se ajusta bien a la hoja.\

\f1\i0\fs15\fsmilli7875 P\'e1gina 6 de 8
\f3\fs24 \cf0 \page 
\f1\fs15\fsmilli7875 \cf3 Perfiles Bodega y Encargado\

\fs21 \cf4 Conviene revisar los estilos de impresi\'f3n de los reportes; es probable que falte ajustar el ancho o la escala para que el\
contenido quepa completo en una sola hoja. De preferencia, que las medidas del contenido sean de media carta, y los\
resurtidos de m\'e1s de una hoja de contenido, queda en una hoja de tama\'f1o carta.\

\f0\b\fs30 \cf2 C. Solicitud de nueva funcionalidad\

\fs20\fsmilli10125 \cf5 C1 
\fs24 \cf2 Ventas individuales por vendedor\

\f1\b0\fs21 \cf4 Algunas sucursales operan con m\'e1s de una persona en piso \'97 por ejemplo, Sucursal que esta por el mercado principal\
de la ciudad, tiene un encargado y dos vendedores adicionales. Actualmente no hay forma de distinguir cu\'e1nto vendi\'f3\
cada uno seg\'fan el sistema.\

\f4\i\fs17\fsmilli8625 \cf3 Referencia visual de c\'f3mo podr\'eda verse el listado de ventas por vendedor.\

\f0\i0\b\fs20\fsmilli10125 \cf2 Propuesta\

\f1\b0 \cf6 \uc0\u9679 
\f5  
\f1\fs21 \cf4 Agregar, dentro del perfil de encargado, la secci\'f3n "Gesti\'f3n de usuarios" que se encuentra en el perfil\
administrativo (y su submen\'fa "Usuarios y roles") por una llamada "Ventas individuales".\

\fs20\fsmilli10125 \cf6 \uc0\u9679 
\f5  
\f1\fs21 \cf4 Mostrar un listado de las personas dadas de alta en esa sucursal, con las mismas columnas que hoy tiene la\
tabla de usuarios (usuario, rol, sucursal), agregando una columna con el total vendido en el mes.\

\fs20\fsmilli10125 \cf6 \uc0\u9679 
\f5  
\f1\fs21 \cf4 Esta vista ser\'eda de solo lectura para el encargado: sin la columna de Acciones ni la opci\'f3n de agregar usuario,\
que hoy solo deber\'eda estar disponible para el administrador.\
El objetivo es que el encargado pueda ver, de un vistazo, cu\'e1nto vendi\'f3 cada vendedor de su sucursal (y \'e9l mismo)\
durante el mes, sin necesidad de permisos de administraci\'f3n de usuarios.\

\f0\b\fs30 \cf2 D. Dudas de proceso (aclarar antes de seguir probando)\

\f1\b0\fs20\fsmilli10125 \cf6 \uc0\u9679 
\f5  
\f1\fs21 \cf4 \'bfCu\'e1l es el flujo completo esperado de traspaso de mercanc\'eda entre Bodega y Sucursal, y viceversa? (para\
confirmar si lo que se est\'e1 probando en resurtidos es el camino correcto, o si existe otro m\'f3dulo pensado para\
esto).\

\fs20\fsmilli10125 \cf6 \uc0\u9679 
\f5  
\f1\fs21 \cf4 \'bfC\'f3mo se registra el uso o canje de un vale para que quede reflejado en el corte de caja del d\'eda?\

\f0\b\fs30 \cf2 Resumen para seguimiento
\f3\b0\fs24 \cf0 \

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrt\brdrnil \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 ID \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Descripci\'f3n \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Tipo \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Prioridad\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 A1 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Resurtido genera inventario fantasma (falta par\'e1metro en\
create_shipping_order) \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Bug de datos \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Alta\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 A2 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Doble ruta para completar solicitud (\'edcono r\'e1pido vs. modal) \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Bug de UX \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Alta\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrt\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 A3 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Devoluciones no mueven inventario en ning\'fan sentido \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Bug de datos \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Alta\cell \lastrow\row
\pard\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 \

\f1\fs15\fsmilli7875 \cf3 P\'e1gina 7 de 8
\f3\fs24 \cf0 \page 
\f1\fs15\fsmilli7875 \cf3 Perfiles Bodega y Encargado
\f3\fs24 \cf0 \

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrt\brdrnil \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 ID \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Descripci\'f3n \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Tipo \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Prioridad\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 A4 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Consulta de stock por sucursal marca 0 incorrectamente \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Bug de datos \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Alta\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 A5 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 No se puede liquidar cr\'e9dito completo \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Bug de validaci\'f3n \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Media\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 A6 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Error al imprimir nota de venta mayoreo \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Bug de interfaz \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Media\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 B1 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Nota de resurtido sin precio unit./subtotal \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Formato \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Media\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 B2 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Impresi\'f3n de notas cortada o muy peque\'f1a \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Formato \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Baja\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 C1 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Ventas individuales por vendedor \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Funcionalidad nueva \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 \'97\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 D1 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Duda: flujo completo de traspaso bodega
\f6 \uc0\u8596 
\f3 sucursal \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Aclaraci\'f3n \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 \'97\cell \row

\itap1\trowd \taflags0 \trgaph108\trleft-108 \trbrdrl\brdrnil \trbrdrt\brdrnil \trbrdrr\brdrnil 
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx2160
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx4320
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx6480
\clvertalt \clshdrawnil \clbrdrt\brdrnil \clbrdrl\brdrnil \clbrdrb\brdrnil \clbrdrr\brdrnil \clpadl0 \clpadr0 \gaph\cellx8640
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 D2 \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Duda: registro de vales en corte de caja \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 Aclaraci\'f3n \cell 
\pard\intbl\itap1\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 \'97\cell \lastrow\row
\pard\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0
\cf0 \
\pard\tx560\tx1120\tx1680\tx2240\tx2800\tx3360\tx3920\tx4480\tx5040\tx5600\tx6160\tx6720\pardirnatural\partightenfactor0

\f4\i\fs18\fsmilli9375 \cf3 Nota: todo lo anterior fue detectado en ambiente de pruebas, antes de la salida a sucursales.}
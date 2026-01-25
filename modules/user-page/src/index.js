import $ from 'jquery';
import QRCode from 'qrcode';

export default () => {
  const apos = window.apos;

  apos.userPage = {};

  apos.util.onReady(async () => {
    apos.userPage.$page = $('[data-qr-page]');
    if (apos.userPage.$page.length !== 0) {
      apos.userPage.initIndexPage();
    }
  });

  apos.userPage.initIndexPage = () => {
    // Generar códigos QR
    $('[data-qr]').each(async function () {
      const $qr = $(this);
      const id = $qr.data('id');

      try {
        const qrDataUrl = await QRCode.toDataURL(id, {
          width: 150,
          margin: 10,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        // Insertar imagen del QR en el div
        $qr.html(`<img src="${qrDataUrl}" alt="QR Code" style="max-width: 100%; height: auto;">`);
      } catch (error) {
        console.error('Error generando QR:', error);
        $qr.text('Error al generar QR');
      }
    });

    // Configurar botones de impresión
    $('[data-print-qr]').on('click', function () {
      const $row = $(this).closest('tr');
      const $qr = $row.find('[data-qr]');
      const userName = $row.find('td:first').text();

      // Obtener imagen del QR
      const qrImage = $qr.find('img').attr('src');

      if (!qrImage) {
        alert('El código QR aún no está listo');
        return;
      }

      // Crear ventana de impresión
      const printWindow = window.open('', '', 'height=400,width=400');

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Imprimir QR - ${userName}</title>
            <style>
              body {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
              }
              img {
                max-width: 300px;
                margin: 20px 0;
              }
              h2 {
                margin-bottom: 30px;
              }
            </style>
          </head>
          <body>
            <h2>Código QR - ${userName}</h2>
            <img src="${qrImage}" alt="QR Code">
            <script>
              window.print();
              window.close();
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    });
  };
};

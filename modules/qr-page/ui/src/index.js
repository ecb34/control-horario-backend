import $ from 'jquery';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Swal from 'sweetalert2';

export default () => {
  const apos = window.apos;

  apos.qrPage = {};
  let scanner = null;
  let employeeId = null;

  apos.util.onReady(async () => {
    apos.qrPage.$page = $('[data-qr-page]');
    if (apos.qrPage.$page.length !== 0) {
      apos.qrPage.initIndexPage();
    }
  });

  apos.qrPage.initIndexPage = () => {
    if (scanner) {
      return;
    }

    const config = {
      fps: 10,
      qrbox: {
        width: 300,
        height: 300
      },
      aspectRatio: 1.0
    };

    scanner = new Html5QrcodeScanner('qr-reader', config, false);

    const onScanSuccess = async (decodedText) => {
      employeeId = decodedText;
      try {
        const response = await apos.http.post('/api/v1/time-entry/register', {
          body: {
            employeeId: decodedText
          }
        });

        if (response.status === 'workStarted') {
          Swal.fire({
            title: `Bienvenido de nuevo, ${response.fullName}.`,
            text: 'Has iniciado tu jornada laboral.',
            icon: 'success'
          });
        } else if (response.status === 'workInProgress') {
          $('#scanner-wrapper').hide();
          $('#actions-wrapper').show();
        } else if (response.status === 'breakInProgress') {
          $('#scanner-wrapper').hide();
          $('#actions-wrapper').show();
        } else if (response.status === 'entryRecorded') {
          Swal.fire({
            title: `Registro exitoso, ${response.fullName}.`,
            text: 'Has registrado tu entrada.',
            icon: 'success'
          });
          $('#scanner-wrapper').show();
          $('#actions-wrapper').hide();
        } else {
          Swal.fire({
            title: 'Error!',
            text: response.message,
            icon: 'error'
          });
        }

        scanner = null;
      } catch (error) {
        Swal.fire({
          title: 'Error en la solicitud!',
          text: error.message,
          icon: 'error'
        });
      }
    };

    try {
      scanner.render(onScanSuccess);
    } catch (error) {
      Swal.fire({
        title: 'Error al iniciar cámara',
        text: error.message,
        icon: 'error'
      });
      scanner = null;
    }

    $('[data-action]').on('click', async function () {
      const actionType = $(this).data('action');
      try {
        const response = await apos.http.post('/api/v1/time-entry/register', {
          body: {
            employeeId,
            eventType: actionType
          }
        });

        if (response.status === 'entryRecorded') {
          Swal.fire({
            title: `Registro exitoso, ${response.fullName}.`,
            text: 'Has registrado tu entrada.',
            icon: 'success'
          });
          $('#scanner-wrapper').show();
          $('#actions-wrapper').hide();
          employeeId = null;
        } else {
          Swal.fire({
            title: 'Error!',
            text: response.message,
            icon: 'error'
          });
        }

        scanner = null;
      } catch (error) {
        Swal.fire({
          title: 'Error en la solicitud!',
          text: error.message,
          icon: 'error'
        });
      }
    });
  };
};

import $ from 'jquery';
import { Html5Qrcode } from 'html5-qrcode';
export default () => {
  const apos = window.apos;

  apos.qrPage = {};

  apos.util.onReady(async () => {
    apos.qrPage.$page = $('[data-qr-page]');
    if (apos.qrPage.$page.length !== 0) {
      await apos.qrPage.initIndexPage();
    }

    apos.qrPage.initIndexPage = async () => {
      apos.qrPage.$page.on('click', '[data-qr-button]', async function () {
        await Html5Qrcode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: {
              width: 300,
              height: 300
            },
            aspectRatio: 1.0
          },
          async (decodedText) => {
            const response = await apos.http.post('/modules/time-entry/register', {
              body: {
                username: decodedText
              }
            });

            if (response.status === 'workStarted') {
              alert(`Bienvenido de nuevo, ${response.fullName}. Has iniciado tu jornada laboral.`);
            }

            if (response.status === 'error') {
              alert(`Error: ${response.message}`);
            }

            $('#scanner-wrapper').hide();
            $('#actions-wrapper').show();
            await Html5Qrcode.stop();
          }
        );
      });
    };
  });
};

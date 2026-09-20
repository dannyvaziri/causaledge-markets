import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/base.css';
import './styles/panels.css';
import './styles/overlays.css';
import './styles/consumer.css';
import './styles/bots.css';
import './styles/phase-five.css';

export const metadata = {
  title: 'CausalEdge Markets | Paper Investing',
  description: 'A calm paper-only stocks and ETFs workspace with transparent bot decisions and account-level safety controls.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

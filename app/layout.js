import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/base.css';
import './styles/panels.css';
import './styles/overlays.css';

export const metadata = {
  title: 'CausalEdge Markets | Global Market Intelligence',
  description: 'Live global intelligence, market monitoring, AI dossiers, and autonomous paper trading with deterministic risk controls.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

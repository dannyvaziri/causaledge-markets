import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/base.css';
import './styles/panels.css';
import './styles/overlays.css';
import './styles/consumer.css';
import './styles/bots.css';

export const metadata = {
  title: 'CausalEdge Markets | Multi-Bot Paper Investing',
  description: 'A paper-only investing workspace with independent stock and crypto bots, shared account risk controls, AI explanations, and global market intelligence.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

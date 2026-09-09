import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/base.css';
import './styles/panels.css';
import './styles/overlays.css';
import './styles/consumer.css';

export const metadata = {
  title: 'CausalEdge Markets | Invest with context',
  description: 'A consumer investing research experience with portfolio context, transparent strategies, AI explanations, and global market intelligence.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

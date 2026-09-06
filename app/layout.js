import './globals.css';

export const metadata = {
  title: 'SignalForge | $100 Challenge',
  description: 'Personal AI market-monitoring and autonomous paper-trading experiment with deterministic risk controls.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

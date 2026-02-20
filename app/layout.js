import './globals.css';

export const metadata = {
  title: 'Vocabulary Battle',
  description: 'Two-player vocabulary game',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}

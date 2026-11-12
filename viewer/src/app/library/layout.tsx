import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import './library.css';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="platform-page library-page">
      <a className="library-skip" href="#library-main">Skip to content</a>
      <BrandBar sticky />
      <main id="library-main">{children}</main>
      <Footer />
    </div>
  );
}

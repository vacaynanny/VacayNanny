import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="sec">
      <div className="sec-inner">
        <div className="footer-grid">
          <div>
            <div className="footer-logo">Vacay<em>Nanny</em></div>
            <p className="footer-about">Kenya&apos;s first dedicated holiday childcare platform. Professional nannies for families who believe great vacations and great parenting go hand in hand.</p>
            <div className="footer-social">
              <a href="https://www.instagram.com/" className="soc-btn" target="_blank" rel="noopener noreferrer">ig</a>
              <a href="https://www.facebook.com/" className="soc-btn" target="_blank" rel="noopener noreferrer">f</a>
              <a href="https://www.linkedin.com/" className="soc-btn" target="_blank" rel="noopener noreferrer">in</a>
            </div>
          </div>
          <div className="footer-col">
            <h4>For Families</h4>
            <ul>
              <li><Link href="/#how">How It Works</Link></li>
              <li><Link href="/nannies">Our Nannies</Link></li>
              <li><Link href="/#pricing">Pricing</Link></li>
              <li><Link href="/#destinations">Destinations</Link></li>
              <li><Link href="/#faq">FAQ</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>For Nannies</h4>
            <ul>
              <li><Link href="/become-a-nanny">Apply Now</Link></li>
              <li><Link href="/about">About VacayNanny</Link></li>
              <li><Link href="/contact">Training questions</Link></li>
              <li><Link href="/login">Nanny login</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <ul>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/waitlist">Expansion waitlist</Link></li>
              <li><Link href="/privacy">Privacy Policy</Link></li>
              <li><Link href="/terms">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} VacayNanny Ltd. All rights reserved.</span>
          <div className="footer-bottom-links">
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
            <Link href="/cookies">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

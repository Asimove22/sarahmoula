import { LangProvider } from './context/LangContext'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Indicators from './components/Indicators'
import Apropos from './components/Apropos'
import Services from './components/Services'
import Portfolio from './components/Portfolio'
import Roadmap from './components/Roadmap'
import Team from './components/Team'
import Contact from './components/Contact'
import Footer from './components/Footer'

export default function App() {
  return (
    <LangProvider>
      <div className="min-h-screen bg-navy-dz">
        <Navbar />
        <main>
          <Hero />
          <Indicators />
          <Apropos />
          <Services />
          <Portfolio />
          <Roadmap />
          <Team />
          <Contact />
        </main>
        <Footer />
      </div>
    </LangProvider>
  )
}

import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Apropos from './components/Apropos'
import Services from './components/Services'
import Portfolio from './components/Portfolio'
import Roadmap from './components/Roadmap'
import Team from './components/Team'
import Contact from './components/Contact'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen bg-navy-dz">
      <Navbar />
      <main>
        <Hero />
        <Apropos />
        <Services />
        <Portfolio />
        <Roadmap />
        <Team />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}

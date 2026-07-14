import CinematicScene from "@/components/CinematicScene";
import SelectedWork from "@/components/SelectedWork";
import ReferencesArchive from "@/components/ReferencesArchive";
import ContactSection from "@/components/ContactSection";
import LangToggle from "@/components/LangToggle";
import Preloader from "@/components/Preloader";

export default function Home() {
  return (
    <main>
      <Preloader />
      <LangToggle />
      <CinematicScene />
      <SelectedWork />
      <ReferencesArchive />
      <ContactSection />
    </main>
  );
}

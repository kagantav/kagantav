import CinematicScene from "@/components/CinematicScene";
import SelectedWork from "@/components/SelectedWork";
import ReferencesArchive from "@/components/ReferencesArchive";
import ContactSection from "@/components/ContactSection";
import LangToggle from "@/components/LangToggle";
import Preloader from "@/components/Preloader";
import LayoutRefresh from "@/components/LayoutRefresh";

export default function Home() {
  return (
    <main>
      <Preloader />
      <LayoutRefresh />
      <LangToggle />
      <CinematicScene />
      <SelectedWork />
      <ReferencesArchive />
      <ContactSection />
    </main>
  );
}

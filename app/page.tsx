import CinematicScene from "@/components/CinematicScene";
import SelectedWork from "@/components/SelectedWork";
import ReferencesArchive from "@/components/ReferencesArchive";
import ContactSection from "@/components/ContactSection";
import LangToggle from "@/components/LangToggle";

export default function Home() {
  return (
    <main>
      <LangToggle />
      <CinematicScene />
      <SelectedWork />
      <ReferencesArchive />
      <ContactSection />
    </main>
  );
}

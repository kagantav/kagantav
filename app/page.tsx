import Header from "@/components/Header";
import CinematicScene from "@/components/CinematicScene";
import SelectedWork from "@/components/SelectedWork";
import ReferencesArchive from "@/components/ReferencesArchive";

export default function Home() {
  return (
    <main>
      <Header />
      <CinematicScene />
      <SelectedWork />
      <ReferencesArchive />
    </main>
  );
}

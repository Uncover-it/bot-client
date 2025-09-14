import MessageBox from "@/components/messagebox";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <main className="overflow-hidden min-h-screen flex flex-col">
      <div className="flex-1"></div>
      <footer className="absolute bottom-0 w-full items-end p-2 flex z-50">
        <MessageBox id={(await props.params).id} />
      </footer>
    </main>
  );
}
import MessageBox from "@/components/messagebox";

export default async function Page(props: { params: Promise<{ id: string }> }) {
  return (
    <main className="overflow-hidden min-h-screen flex flex-col">
      <div className="flex-1"></div>
      <footer className="w-full items-end h-16 p-2 flex">
        <MessageBox id={(await props.params).id} />
      </footer>
    </main>
  );
}

export default function DataDeletionStatusPage({ searchParams }: { searchParams: Record<string, string> }) {
  const code = (searchParams?.code || '').toString();
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full border bg-white rounded-2xl shadow-sm p-6 text-gray-800">
        <h1 className="text-xl font-semibold">Data Deletion Request</h1>
        <p className="text-sm text-gray-700 mt-2">
          Your deletion request has been received{code ? ' (code: ' + code + ')' : ''}.
        </p>
        <p className="text-sm text-gray-700 mt-2">
          If you have an account, please sign in and open the Profile menu → “Delete my data…” to complete deletion instantly.
          If you do not have access, contact support and include the code above.
        </p>
        <div className="text-xs text-gray-500 mt-4">
          For assistance, email <a className="underline" href="mailto:support@prosper.com">support@prosper.com</a>.
        </div>
      </div>
    </main>
  );
}


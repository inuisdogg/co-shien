export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">ページが見つかりません</h2>
        <a
          href="/"
          className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors inline-block"
        >
          ホームに戻る
        </a>
      </div>
    </div>
  );
}










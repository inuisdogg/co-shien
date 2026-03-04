export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-7xl font-bold text-primary/20 mb-2">404</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">ページが見つかりません</h2>
        <p className="text-sm text-gray-500 mb-6">お探しのページは移動または削除された可能性があります。</p>
        <a
          href="/"
          className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors inline-block font-medium text-sm"
        >
          ホームに戻る
        </a>
      </div>
    </div>
  );
}

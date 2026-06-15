import { FooterContactButton } from "@/app/components/FooterContactButton";
import { Container } from "@/app/components/Container";
import { LanguageSelector } from "@/app/components/LanguageSelector";
import { getDictionary, localizePath, type Locale } from "@/lib/i18n";

export function Footer({ locale }: { locale: Locale }) {
  const currentYear = new Date().getFullYear();
  const dictionary = getDictionary(locale);

  return (
    <footer className="bg-white border-t border-neutral-200 mt-12 pb-20 md:pb-0">
      <Container className="py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-neutral-900 mb-4">SYU CAMPUS</h3>
            <p className="text-sm text-neutral-600">
              {dictionary.footer.tagline}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-neutral-900 mb-3">
              {dictionary.footer.mainMenu}
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={localizePath("/academic", locale)}
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  {dictionary.footer.academicInfo}
                </a>
              </li>
              <li>
                <a
                  href={localizePath("/campus", locale)}
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  {dictionary.footer.campusInfo}
                </a>
              </li>
              <li>
                <a
                  href={localizePath("/more", locale)}
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  {dictionary.footer.more}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-neutral-900 mb-3">
              {dictionary.footer.contactHeading}
            </h4>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li>
                <FooterContactButton />
              </li>
              <li>
                <a
                  href="mailto:singhic_dev@syu.kr"
                  className="text-neutral-500 hover:text-neutral-700 transition-colors"
                >
                  {dictionary.footer.emailContact}
                </a>
              </li>
            </ul>
            <div className="mt-4">
              <LanguageSelector />
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-xs sm:text-sm text-neutral-600">
              © {currentYear} SYU KR(Seo Sang Hyeok). All rights reserved.
            </p>
            <div className="flex gap-4 text-xs sm:text-sm">
              <a
                href={localizePath("/terms", locale)}
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                {dictionary.footer.terms}
              </a>
              <a
                href={localizePath("/privacy", locale)}
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                {dictionary.footer.privacy}
              </a>
              <a
                href={localizePath("/more/privacy", locale)}
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                {dictionary.footer.notificationPrivacy}
              </a>
              <a
                href="https://github.com/syu-kr/campus.syu.kr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={dictionary.footer.githubRepo}
                title={dictionary.footer.githubTitle}
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.867-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.455-1.158-1.111-1.466-1.111-1.466-.908-.622.069-.609.069-.609 1.004.071 1.532 1.033 1.532 1.033.892 1.53 2.341 1.088 2.91.832.091-.647.349-1.088.635-1.338-2.221-.253-4.555-1.113-4.555-4.951 0-1.094.39-1.988 1.03-2.688-.103-.254-.446-1.274.098-2.654 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.864c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.38.203 2.4.1 2.654.64.7 1.028 1.594 1.028 2.688 0 3.848-2.338 4.695-4.566 4.943.359.31.678.922.678 1.859 0 1.341-.012 2.423-.012 2.752 0 .268.18.58.688.481A10.025 10.025 0 0 0 22 12.021C22 6.484 17.523 2 12 2Z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}

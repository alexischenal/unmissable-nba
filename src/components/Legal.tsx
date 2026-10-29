// src/components/Legal.tsx
// The legal notice: who publishes the site, who hosts it, how to reach the publisher.
// A personal, non-commercial site: the publisher's identity is given to the host, not published here.

const CONTACT = 'alexis@unmissable.watch';

export function Legal() {
  return (
    <article className="article">
      <h1 className="article__title">Legal notice</h1>

      <h2 className="article__subtitle">Publisher</h2>
      <p className="article__text">
        Unmissable.watch is a personal, non-commercial website. As allowed for non-professional publishers, the
        publisher's identity has been provided to the host.
      </p>
      <p className="article__text">
        Contact: <a className="article__link" href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>

      <h2 className="article__subtitle">Host</h2>
      <p className="article__text">
        GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, United States.
      </p>

      <h2 className="article__subtitle">The NBA</h2>
      <p className="article__text">
        Unmissable.watch is not affiliated with, endorsed or sponsored by the NBA or its teams. Team names belong
        to their owners. Game data comes from the NBA's public statistics.
      </p>

      <h2 className="article__subtitle">Personal data</h2>
      <p className="article__text">No account, no cookies: the site doesn't collect any personal data.</p>
    </article>
  );
}

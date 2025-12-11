FROM node:20-slim

USER root
RUN mkdir /app
COPY ./* /app
RUN chmod -R +x /app/*

WORKDIR /app
RUN npm install

ENTRYPOINT ["/app/entrypoint.sh"]